# Copyright 2018 The TensorFlow Authors. All Rights Reserved.
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
"""Summary creation methods for the HParams plugin.

Typical usage for exporting summaries in a hyperparameters-tuning experiment:
1. Create the experiment (once) by calling experiment_pb() and exporting
   the resulting summary into a top-level (empty) run.
2. In each training session in the experiment, call session_start_pb() before
   the session starts, exporting the resulting summary into a uniquely named
   run for the session, say <session_name>.
3. Train the model in the session, exporting each metric as a scalar summary
   in runs of the form <session_name><suffix>, where suffix depends on the
   metric, and may be empty. The name of such a metric is a (group, tag) pair
   given by (<suffix>, tag) where tag is the tag of the scalar summary.
   When calling experiment_pb in step 1, you'll need to pass all the metric
   names used in the experiemnt.
4. When the session completes, call session_end_pb() and export the resulting
   summary into the same session run <session_name>.
"""

from __future__ import absolute_import
from __future__ import division
from __future__ import print_function

import datetime

import six
import tensorflow as tf
from google.protobuf import timestamp_pb2

from tensorboard.plugins.hparams import api_pb2
from tensorboard.plugins.hparams import plugin_data_pb2
from tensorboard.plugins.hparams import metadata


def experiment_pb(
    hparam_infos,
    metric_infos,
    user="",
    description="",
    time_created=datetime.datetime.now()):
  """Creates a summary that defines a hyperparameter-tuning experiment.
  Arguments:
    hparam_infos: Array of api_pb2.HParamInfo messages. Describes the
        hyperparameters used in the experiment.
    metric_infos: Array of api_pb2.MetricInfo messages. Describes the metrics
        used in the experiment. See the documentation at the top of this file
        for how to populate this.
    user: String. An id for the user running the experiment
    description: String. A description for the experiment. May contain markdown.
    time_created: datetime. The time the experiment is created.

  Returns:
    A summary protobuffer containing the experiment definition.
  """
  experiment = api_pb2.Experiment(
      description=description,
      user=user,
      time_created=timestamp_pb2.Timestamp().FromDatetime(time_created),
      hparam_infos=hparam_infos,
      metric_infos=metric_infos)
  return _summary(metadata.EXPERIMENT_TAG,
                  plugin_data_pb2.HParamsPluginData(experiment=experiment))


def session_start_pb(hparams,
                     model_uri="",
                     monitor_url="",
                     group_name=""):
  """Creates a summary that contains a training session metadata information.
  One such summary per training session should be created. Each should have
  a different run.

  Arguments:
    hparams: A dictionary with string keys. Describes the hyperparameter values
             used in the session mappng each hyperparameter name to its value.
             Supported value types are  bool, int, float, or str.
    model_uri: See the comment for the field with the same name of
               plugin_data_pb2.SessionStartInfo.
    monitor_url: See the comment for the field with the same name of
                 plugin_data_pb2.SessionStartInfo.
    group_name:  See the comment for the field with the same name of
                 plugin_data_pb2.SessionStartInfo.
  Returns:
    Returns the summary protobuffer mentioned above.
  """
  session_start_info = plugin_data_pb2.SessionStartInfo(
      model_uri=model_uri,
      monitor_url=monitor_url,
      group_name=group_name)
  for (hp_name, hp_val) in six.iteritems(hparams):
    if isinstance(hp_val, (float, int)):
      session_start_info.hparams[hp_name].number_value = hp_val
    elif isinstance(hp_val, six.string_types):
      session_start_info.hparams[hp_name].string_value = hp_val
    elif isinstance(hp_val, bool):
      session_start_info.hparams[hp_name].bool_value = hp_val
    else:
      raise TypeError('hparams[%s]=%s has type: %s which is not supported' %
                      (hp_name, hp_val, type(hp_val)))
  return _summary(metadata.SESSION_START_INFO_TAG,
                  plugin_data_pb2.HParamsPluginData(
                      session_start_info=session_start_info))


def session_end_pb(status):
  """Creates a summary that contains status information for a completed
  training session. Should be exported after the training session is completed.
  One such summary per training session should be created. Each should have
  a different run.
  Arguments:
    status: A tensorboard.hparams.Status enumeration value denoting the
            status of the session.

  Returns:
    Returns the summary protobuffer mentioned above.
  """
  session_end_info = plugin_data_pb2.SessionEndInfo(status=status)
  return _summary(metadata.SESSION_END_INFO_TAG,
                  plugin_data_pb2.HParamsPluginData(
                      session_end_info=session_end_info))


def _summary(tag, hparams_plugin_data):
  """Helper function for creating a summary holding the given HParamsPluginData
  message.
  """
  summary = tf.Summary()
  summary.value.add(
      tag=tag,
      metadata=metadata.create_summary_metadata(hparams_plugin_data))
  return summary
