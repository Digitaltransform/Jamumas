# Copyright 2015 The TensorFlow Authors. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================

"""Functionality for loading events from a record file."""

import contextlib

from tensorboard import data_compat
from tensorboard import dataclass_compat
from tensorboard.compat import tf
from tensorboard.compat.proto import event_pb2
from tensorboard.util import platform_util
from tensorboard.util import tb_logging


logger = tb_logging.get_logger()


@contextlib.contextmanager
def _nullcontext():
    """Pre-Python-3.7-compatible standin for contextlib.nullcontext."""
    yield


# Might as well make this a singleton.
_NULLCONTEXT = _nullcontext()


def _silence_deprecation_warnings():
    """Context manager that best-effort silences TF deprecation warnings."""
    try:
        # Learn this one weird trick to make TF deprecation warnings go away.
        from tensorflow.python.util import deprecation

        return deprecation.silence()
    except (ImportError, AttributeError):
        return _NULLCONTEXT


def _make_tf_record_iterator(file_path):
    """Returns an iterator over TF records for the given tfrecord file."""
    # If we don't have TF at all, use the stub implementation.
    if tf.__version__ == "stub":
        # TODO(#1711): Reshape stub implementation to fit tf_record_iterator API
        # rather than needlessly emulating the old PyRecordReader_New API.
        logger.debug("Opening a stub record reader pointing at %s", file_path)
        return _PyRecordReaderIterator(
            tf.pywrap_tensorflow.PyRecordReader_New, file_path
        )
    # If PyRecordReader exists, use it, otherwise use tf_record_iterator().
    # Check old first, then new, since tf_record_iterator existed previously but
    # only gained the semantics we need at the time PyRecordReader was removed.
    #
    # TODO(#1711): Eventually remove PyRecordReader fallback once we can drop
    # support for TF 2.1 and prior, and find a non-deprecated replacement for
    # tf.compat.v1.io.tf_record_iterator.
    try:
        from tensorflow.python import pywrap_tensorflow

        py_record_reader_new = pywrap_tensorflow.PyRecordReader_New
    except (ImportError, AttributeError):
        py_record_reader_new = None
    if py_record_reader_new:
        logger.debug("Opening a PyRecordReader pointing at %s", file_path)
        return _PyRecordReaderIterator(py_record_reader_new, file_path)
    else:
        logger.debug("Opening a tf_record_iterator pointing at %s", file_path)
        # TODO(#1711): Find non-deprecated replacement for tf_record_iterator.
        with _silence_deprecation_warnings():
            return tf.compat.v1.io.tf_record_iterator(file_path)


class _PyRecordReaderIterator(object):
    """Python iterator for TF Records based on PyRecordReader."""

    def __init__(self, py_record_reader_new, file_path):
        """Constructs a _PyRecordReaderIterator for the given file path.

        Args:
          py_record_reader_new: pywrap_tensorflow.PyRecordReader_New
          file_path: file path of the tfrecord file to read
        """
        with tf.compat.v1.errors.raise_exception_on_not_ok_status() as status:
            self._reader = py_record_reader_new(
                tf.compat.as_bytes(file_path), 0, tf.compat.as_bytes(""), status
            )
        if not self._reader:
            raise IOError(
                "Failed to open a record reader pointing to %s" % file_path
            )

    def __iter__(self):
        return self

    def __next__(self):
        try:
            self._reader.GetNext()
        except tf.errors.OutOfRangeError as e:
            raise StopIteration
        return self._reader.record()

    next = __next__  # for python2 compatibility


class RawEventFileLoader(object):
    """An iterator that yields Event protos as serialized bytestrings."""

    def __init__(self, file_path):
        if file_path is None:
            raise ValueError("A file path is required")
        self._file_path = platform_util.readahead_file_path(file_path)
        self._iterator = _make_tf_record_iterator(self._file_path)

    def Load(self):
        """Loads all new events from disk as raw serialized proto bytestrings.

        Calling Load multiple times in a row will not 'drop' events as long as the
        return value is not iterated over.

        Yields:
          All event proto bytestrings in the file that have not been yielded yet.
        """
        logger.debug("Loading events from %s", self._file_path)
        while True:
            try:
                yield next(self._iterator)
            except StopIteration:
                logger.debug("End of file in %s", self._file_path)
                break
            except tf.errors.DataLossError as e:
                # We swallow partial read exceptions; if the record was truncated
                # and a later update completes it, retrying can then resume from
                # the same point in the file since the iterator holds the offset.
                logger.debug("Truncated record in %s (%s)", self._file_path, e)
                break
        logger.debug("No more events in %s", self._file_path)


class LegacyEventFileLoader(RawEventFileLoader):
    """An iterator that yields parsed Event protos."""

    def Load(self):
        """Loads all new events from disk.

        Calling Load multiple times in a row will not 'drop' events as long as the
        return value is not iterated over.

        Yields:
          All events in the file that have not been yielded yet.
        """
        for record in super(LegacyEventFileLoader, self).Load():
            yield event_pb2.Event.FromString(record)


class EventFileLoader(LegacyEventFileLoader):
    """An iterator that passes events through read-time compat layers.

    Specifically, this includes `data_compat` and `dataclass_compat`.
    """

    def __init__(self, file_path):
        super(EventFileLoader, self).__init__(file_path)
        # Track initial metadata for each tag, for `dataclass_compat`.
        # This is meant to be tracked per run, not per event file, so
        # there is a potential failure case when the second event file
        # in a single run has no summary metadata. This only occurs when
        # all of the following hold: (a) the events were written with
        # the TensorFlow 1.x (not 2.x) writer, (b) the summaries were
        # created by `tensorboard.summary.v1` ops and so do not undergo
        # `data_compat` transformation, and (c) the file writer was
        # reopened by calling `.reopen()` on it, which creates a new
        # file but does not clear the tag cache. This is considered
        # sufficiently improbable that we don't take extra mitigations.
        self._initial_metadata = {}  # from tag name to `SummaryMetadata`

    def Load(self):
        for event in super(EventFileLoader, self).Load():
            event = data_compat.migrate_event(event)
            events = dataclass_compat.migrate_event(
                event, self._initial_metadata
            )
            for event in events:
                yield event


class TimestampedEventFileLoader(EventFileLoader):
    """An iterator that yields (UNIX timestamp float, Event proto) pairs."""

    def Load(self):
        """Loads all new events and their wall time values from disk.

        Calling Load multiple times in a row will not 'drop' events as long as the
        return value is not iterated over.

        Yields:
          Pairs of (UNIX timestamp float, Event proto) for all events in the file
          that have not been yielded yet.
        """
        for event in super(TimestampedEventFileLoader, self).Load():
            yield (event.wall_time, event)
