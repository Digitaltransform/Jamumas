/* Copyright 2017 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import * as _ from 'lodash';
import {FUNCTION_LIBRARY_NODE_PREFIX, OpNode, SlimGraph} from './graph';

export interface CompatibilityProvider {
  opValid: (opNode: OpNode) => boolean;
}
export class TpuCompatibilityProvider implements CompatibilityProvider {
  /**
   * Allowed list of current Tensorflow ops valid on the TPU.
   * Note that some data types may be unsupported.
   */
  static readonly WHITELIST = [
    'Abs',
    'Acos',
    'Acosh',
    'Add',
    'AddN',
    'AddV2',
    'AdjustContrastv2',
    'AdjustHue',
    'AdjustSaturation',
    'All',
    'AllToAll',
    'Angle',
    'Any',
    'ApproximateEqual',
    'ArgMax',
    'ArgMin',
    'Asin',
    'Asinh',
    'Assert',
    'AssignAddVariableOp',
    'AssignSubVariableOp',
    'AssignVariableOp',
    'Atan',
    'Atan2',
    'Atanh',
    'AvgPool',
    'AvgPool3D',
    'AvgPool3DGrad',
    'AvgPoolGrad',
    'BatchMatMul',
    'BatchMatMulV2',
    'BatchToSpace',
    'BatchToSpaceND',
    'BesselI0e',
    'BesselI1e',
    'Betainc',
    'BiasAdd',
    'BiasAddGrad',
    'BiasAddV1',
    'Bitcast',
    'BitwiseAnd',
    'BitwiseOr',
    'BitwiseXor',
    'BroadcastArgs',
    'BroadcastGradientArgs',
    'BroadcastTo',
    'Bucketize',
    'Case',
    'Cast',
    'Ceil',
    'CheckNumerics',
    'Cholesky',
    'ClipByValue',
    'CollectivePermute',
    'CollectiveReduceV2',
    'Complex',
    'ComplexAbs',
    'Concat',
    'ConcatOffset',
    'ConcatV2',
    'Conj',
    'ConjugateTranspose',
    'Const',
    'ControlTrigger',
    'Conv2D',
    'Conv2DBackpropFilter',
    'Conv2DBackpropInput',
    'Conv3D',
    'Conv3DBackpropFilterV2',
    'Conv3DBackpropInputV2',
    'Cos',
    'Cosh',
    'Cross',
    'CrossReplicaSum',
    'Cumprod',
    'Cumsum',
    'DataFormatDimMap',
    'DataFormatVecPermute',
    'DepthToSpace',
    'DepthwiseConv2dNative',
    'DepthwiseConv2dNativeBackpropFilter',
    'DepthwiseConv2dNativeBackpropInput',
    'Dequantize',
    'DeviceIndex',
    'Diag',
    'DiagPart',
    'Digamma',
    'Div',
    'DivNoNan',
    'DynamicStitch',
    'Einsum',
    'Elu',
    'EluGrad',
    'Empty',
    'EmptyTensorList',
    'EnsureShape',
    'Equal',
    'Erf',
    'Erfc',
    'Erfinv',
    'Exp',
    'ExpandDims',
    'Expm1',
    'ExtractImagePatches',
    'FFT',
    'FFT2D',
    'FFT3D',
    'FakeParam',
    'FakeQuantWithMinMaxArgs',
    'FakeQuantWithMinMaxArgsGradient',
    'FakeQuantWithMinMaxVars',
    'FakeQuantWithMinMaxVarsGradient',
    'Fill',
    'Floor',
    'FloorDiv',
    'FloorMod',
    'FusedBatchNorm',
    'FusedBatchNormGrad',
    'FusedBatchNormGradV2',
    'FusedBatchNormGradV3',
    'FusedBatchNormV2',
    'FusedBatchNormV3',
    'Gather',
    'GatherNd',
    'GatherV2',
    'GetItem',
    'Greater',
    'GreaterEqual',
    'HSVToRGB',
    'IFFT',
    'IFFT2D',
    'IFFT3D',
    'IRFFT',
    'IRFFT2D',
    'IRFFT3D',
    'Identity',
    'IdentityN',
    'If',
    'Igamma',
    'IgammaGradA',
    'Igammac',
    'Imag',
    'InTopKV2',
    'InfeedDequeue',
    'InfeedDequeueTuple',
    'InplaceAdd',
    'InplaceUpdate',
    'Inv',
    'Invert',
    'InvertPermutation',
    'IsFinite',
    'IsInf',
    'IsNan',
    'KthOrderStatistic',
    'L2Loss',
    'LRN',
    'LRNGrad',
    'LeakyRelu',
    'LeakyReluGrad',
    'LeftShift',
    'Less',
    'LessEqual',
    'Lgamma',
    'LinSpace',
    'ListDiff',
    'Log',
    'Log1p',
    'LogSoftmax',
    'LogicalAnd',
    'LogicalNot',
    'LogicalOr',
    'LowerBound',
    'MakeUnique',
    'MatMul',
    'MatrixBandPart',
    'MatrixDiag',
    'MatrixDiagPart',
    'MatrixDiagPartV2',
    'MatrixDiagPartV3',
    'MatrixDiagV2',
    'MatrixDiagV3',
    'MatrixInverse',
    'MatrixSetDiag',
    'MatrixSetDiagV2',
    'MatrixSetDiagV3',
    'MatrixSolve',
    'MatrixTriangularSolve',
    'Max',
    'MaxPool',
    'MaxPool3D',
    'MaxPool3DGrad',
    'MaxPool3DGradGrad',
    'MaxPoolGrad',
    'MaxPoolGradGrad',
    'MaxPoolGradGradV2',
    'MaxPoolGradV2',
    'MaxPoolV2',
    'Maximum',
    'Mean',
    'Min',
    'Minimum',
    'MirrorPad',
    'MirrorPadGrad',
    'Mod',
    'Mul',
    'MulNoNan',
    'Multinomial',
    'Ndtri',
    'Neg',
    'NextAfter',
    'NoOp',
    'NonMaxSuppressionV4',
    'NotEqual',
    'OneHot',
    'OnesLike',
    'OutfeedEnqueue',
    'OutfeedEnqueueTuple',
    'Pack',
    'Pad',
    'PadV2',
    'ParallelDynamicStitch',
    'ParameterizedTruncatedNormal',
    'PartitionedCall',
    'PlaceholderWithDefault',
    'Polygamma',
    'PopulationCount',
    'Pow',
    'PreventGradient',
    'Prod',
    'Qr',
    'QuantizeAndDequantizeV2',
    'QuantizeAndDequantizeV3',
    'RFFT',
    'RFFT2D',
    'RFFT3D',
    'RGBToHSV',
    'RandomGammaGrad',
    'RandomShuffle',
    'RandomStandardNormal',
    'RandomUniform',
    'RandomUniformInt',
    'Range',
    'Rank',
    'ReadVariableOp',
    'Real',
    'RealDiv',
    'Reciprocal',
    'ReciprocalGrad',
    'Relu',
    'Relu6',
    'Relu6Grad',
    'ReluGrad',
    'Reshape',
    'ResizeBilinear',
    'ResizeBilinearGrad',
    'ResizeNearestNeighbor',
    'ResizeNearestNeighborGrad',
    'ResourceApplyAdaMax',
    'ResourceApplyAdadelta',
    'ResourceApplyAdagrad',
    'ResourceApplyAdagradDA',
    'ResourceApplyAdagradV2',
    'ResourceApplyAdam',
    'ResourceApplyAddSign',
    'ResourceApplyCenteredRMSProp',
    'ResourceApplyFtrl',
    'ResourceApplyFtrlV2',
    'ResourceApplyGradientDescent',
    'ResourceApplyKerasMomentum',
    'ResourceApplyMomentum',
    'ResourceApplyPowerSign',
    'ResourceApplyProximalAdagrad',
    'ResourceApplyProximalGradientDescent',
    'ResourceApplyRMSProp',
    'ResourceGather',
    'ResourceScatterAdd',
    'ResourceScatterDiv',
    'ResourceScatterMax',
    'ResourceScatterMin',
    'ResourceScatterMul',
    'ResourceScatterNdAdd',
    'ResourceScatterNdSub',
    'ResourceScatterNdUpdate',
    'ResourceScatterSub',
    'ResourceScatterUpdate',
    'ResourceStridedSliceAssign',
    'Reverse',
    'ReverseSequence',
    'ReverseV2',
    'RightShift',
    'Rint',
    'RngReadAndSkip',
    'RngSkip',
    'Roll',
    'Round',
    'Rsqrt',
    'RsqrtGrad',
    'ScatterNd',
    'Select',
    'SelectV2',
    'SelfAdjointEigV2',
    'Selu',
    'SeluGrad',
    'Shape',
    'ShapeN',
    'Sigmoid',
    'SigmoidGrad',
    'Sign',
    'Sin',
    'Sinh',
    'Size',
    'Slice',
    'Snapshot',
    'Softmax',
    'SoftmaxCrossEntropyWithLogits',
    'Softplus',
    'SoftplusGrad',
    'Softsign',
    'SoftsignGrad',
    'SpaceToBatch',
    'SpaceToBatchND',
    'SpaceToDepth',
    'SparseMatMul',
    'SparseSoftmaxCrossEntropyWithLogits',
    'SparseToDense',
    'Split',
    'SplitV',
    'Sqrt',
    'SqrtGrad',
    'Square',
    'SquaredDifference',
    'Squeeze',
    'StackCloseV2',
    'StackPopV2',
    'StackPushV2',
    'StackV2',
    'StatefulPartitionedCall',
    'StatefulStandardNormalV2',
    'StatefulTruncatedNormal',
    'StatefulUniform',
    'StatefulUniformFullInt',
    'StatefulUniformInt',
    'StatelessCase',
    'StatelessIf',
    'StatelessMultinomial',
    'StatelessRandomGetAlg',
    'StatelessRandomGetKeyCounter',
    'StatelessRandomGetKeyCounterAlg',
    'StatelessRandomNormal',
    'StatelessRandomNormalV2',
    'StatelessRandomUniform',
    'StatelessRandomUniformFullInt',
    'StatelessRandomUniformFullIntV2',
    'StatelessRandomUniformInt',
    'StatelessRandomUniformIntV2',
    'StatelessRandomUniformV2',
    'StatelessTruncatedNormal',
    'StatelessTruncatedNormalV2',
    'StatelessWhile',
    'StopGradient',
    'StridedSlice',
    'StridedSliceGrad',
    'Sub',
    'Sum',
    'Svd',
    'SymbolicGradient',
    'TPUEmbeddingActivations',
    'Tan',
    'Tanh',
    'TanhGrad',
    'TensorArrayCloseV3',
    'TensorArrayConcatV3',
    'TensorArrayGatherV3',
    'TensorArrayGradV3',
    'TensorArrayReadV3',
    'TensorArrayScatterV3',
    'TensorArraySizeV3',
    'TensorArraySplitV3',
    'TensorArrayV3',
    'TensorArrayWriteV3',
    'TensorListConcatV2',
    'TensorListElementShape',
    'TensorListFromTensor',
    'TensorListGather',
    'TensorListGetItem',
    'TensorListLength',
    'TensorListPopBack',
    'TensorListPushBack',
    'TensorListReserve',
    'TensorListSetItem',
    'TensorListSplit',
    'TensorListStack',
    'TensorScatterAdd',
    'TensorScatterMax',
    'TensorScatterMin',
    'TensorScatterSub',
    'TensorScatterUpdate',
    'TensorStridedSliceUpdate',
    'Tile',
    'TopKUnique',
    'TopKV2',
    'TopKWithUnique',
    'Transpose',
    'TridiagonalSolve',
    'TruncateDiv',
    'TruncateMod',
    'TruncatedNormal',
    'Unique',
    'Unpack',
    'UnsortedSegmentMax',
    'UnsortedSegmentMin',
    'UnsortedSegmentProd',
    'UnsortedSegmentSum',
    'UpperBound',
    'VarIsInitializedOp',
    'VariableShape',
    'Where',
    'While',
    'Xdivy',
    'XlaBroadcastHelper',
    'XlaConv',
    'XlaConvV2',
    'XlaDequantize',
    'XlaDot',
    'XlaDotV2',
    'XlaDynamicSlice',
    'XlaDynamicUpdateSlice',
    'XlaEinsum',
    'XlaGather',
    'XlaHostCompute',
    'XlaIf',
    'XlaKeyValueSort',
    'XlaPad',
    'XlaRecv',
    'XlaRecvFromHost',
    'XlaReduce',
    'XlaReduceWindow',
    'XlaReplicaId',
    'XlaScatter',
    'XlaSelectAndScatter',
    'XlaSelfAdjointEig',
    'XlaSend',
    'XlaSendToHost',
    'XlaSetBound',
    'XlaSetDynamicDimensionSize',
    'XlaSharding',
    'XlaSort',
    'XlaSpmdFullToShardShape',
    'XlaSpmdShardToFullShape',
    'XlaSvd',
    'XlaVariadicReduce',
    'XlaVariadicSort',
    'XlaWhile',
    'Xlog1py',
    'Xlogy',
    'ZerosLike',
    'Zeta',

    // Ops below are manually whitelisted and should not be evaluated for
    // compatibility for various reasons.

    // Control flow ops.
    'Enter',
    'Exit',
    'LoopCond',
    'Merge',
    'NextIteration',
    'Switch',
    // Ops below are inserted by the compiler.
    '_Arg',
    '_ArrayToList',
    '_FusedBatchNormEx',
    '_ListToArray',
    '_ParallelConcatUpdate',
    '_RecvTPUEmbeddingActivations',
    '_RecvTPUEmbeddingDeduplicationData',
    '_Retval',
    '_SendTPUEmbeddingGradients',
    '_TPUCompile',
    '_TPUExecute',
    '_UnaryOpsComposition',
    // Distributed TPU ops.
    'TPUCompilationResult',
    'TPUReplicatedInput',
    'TPUReplicatedOutput',
    'TPUReplicateMetadata',
    // Checkpointing ops.
    'MergeV2Checkpoints',
    'RestoreV2',
    'SaveV2',
    // Miscellaneous CPU ops.
    'Abort',
    'Assert',
    'Assign',
    'Placeholder',
    'PlaceholderV2',
    'ShardedFilename',
    'StringJoin',
    'Variable',
    'VariableV2',
    'VarHandleOp',
    // Summary ops.
    'AudioSummary',
    'AudioSummaryV2',
    'DebugNumericSummary',
    'HistogramSummary',
    'ImageSummary',
    'MergeSummary',
    'ScalarSummary',
    'StatsAggregatorSummary',
  ];

  /**
   * Returns true if the node's inferred device is not the TPU.
   * Note that this is only a best-effort check.
   */
  private isNotTpuOp(opDevice: string): boolean {
    if (opDevice.toLowerCase().search('cpu:') != -1) {
      return true;
    }
    if (opDevice.toLowerCase().search('gpu:') != -1) {
      return true;
    }
    return opDevice.toLowerCase().search('tpu') == -1;
  }
  opValid(opNode: OpNode): boolean {
    // Function library nodes are generally for internal use.
    if (opNode.name.search(FUNCTION_LIBRARY_NODE_PREFIX) == 0) {
      return true;
    }
    // Nodes that lack op types should be ignored.
    if (!opNode.op) {
      return true;
    }
    // If assigned a device that is not TPU-related assume op is valid.
    if (opNode.device && this.isNotTpuOp(opNode.device)) {
      return true;
    }
    // If assigned to the TPU_SYSTEM device, assume op is valid.
    if (opNode.device && opNode.device.search('TPU_SYSTEM') != -1) {
      return true;
    }
    return _.includes(TpuCompatibilityProvider.WHITELIST, opNode.op);
  }
}
export function checkOpsForCompatibility(
  graph: SlimGraph,
  provider: CompatibilityProvider
) {
  if (provider === null) {
    throw new Error('Compatibility provider required, but got: ' + provider);
  }
  _.each(graph.nodes, (node) => {
    node.compatible = provider.opValid(node);
    _.each(node.inEmbeddings, (node) => {
      node.compatible = provider.opValid(node);
    });
    _.each(node.outEmbeddings, (node) => {
      node.compatible = provider.opValid(node);
    });
  });
}
