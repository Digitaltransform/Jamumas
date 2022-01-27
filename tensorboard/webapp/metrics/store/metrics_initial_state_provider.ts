/* Copyright 2021 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {InjectionToken} from '@angular/core';
import {StoreConfig} from '@ngrx/store';

import {INITIAL_STATE} from './metrics_reducers';
import {MetricsState} from './metrics_types';

/** @typehack */ import * as _typeHackStore from '@ngrx/store';

export const METRICS_STORE_CONFIG_TOKEN = new InjectionToken<
  StoreConfig<MetricsState>
>('Metrics Store Config');

export const METRICS_INITIAL_SETTINGS = new InjectionToken<
  StoreConfig<MetricsState['settings'] | null>
>('Metrics Initial Settings Config');

export function getConfig(
  settings: MetricsState['settings']
): StoreConfig<MetricsState> {
  if (!settings) {
    return {
      initialState: INITIAL_STATE,
    };
  }

  return {
    initialState: {
      // For other states, please make sure you only provide the routeless state. Routeful
      // initial state cannot be dependency injected as of right now.
      ...INITIAL_STATE,
      settings,
    },
  };
}
