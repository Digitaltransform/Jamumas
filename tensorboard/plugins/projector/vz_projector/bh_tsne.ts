/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

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

/**
 * This is a fork of the Karpathy's TSNE.js (original license below).
 * This fork implements Barnes-Hut approximation and runs in O(NlogN)
 * time, as opposed to the Karpathy's O(N^2) version.
 *
 * @author smilkov@google.com (Daniel Smilkov)
 */

/**
 * @license
 * The MIT License (MIT)
 * Copyright (c) 2015 Andrej Karpathy
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {SPNode, SPTree} from './sptree.js';

type AugmSPNode = SPNode&{numCells: number, yCell: number[], rCell: number};

/**
 * Barnes-hut approximation level. Higher means more approximation and faster
 * results. Recommended value mentioned in the paper is 0.8.
 */
const THETA = 0.8;

const MIN_POSSIBLE_PROB = 1E-9;

// Variables used for memorizing the second random number since running
// gaussRandom() generates two random numbers at the cost of 1 atomic
// computation. This optimization results in 2X speed-up of the generator.
let return_v = false;
let v_val = 0.0;

/** Returns the square euclidean distance between two vectors. */
export function dist2(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors a and b must be of same length');
  }

  let result = 0;
  for (let i = 0; i < a.length; ++i) {
    let diff = a[i] - b[i];
    result += diff * diff;
  }
  return result;
}

/** Returns the square euclidean distance between two 2D points. */
export function dist2_2D(a: number[], b: number[]): number {
  let dX = a[0] - b[0];
  let dY = a[1] - b[1];
  return dX * dX + dY * dY;
}

/** Returns the square euclidean distance between two 3D points. */
export function dist2_3D(a: number[], b: number[]): number {
  let dX = a[0] - b[0];
  let dY = a[1] - b[1];
  let dZ = a[2] - b[2];
  return dX * dX + dY * dY + dZ * dZ;
}

function gaussRandom(rng: () => number): number {
  if (return_v) {
    return_v = false;
    return v_val;
  }
  let u = 2 * rng() - 1;
  let v = 2 * rng() - 1;
  let r = u * u + v * v;
  if (r === 0 || r > 1) {
    return gaussRandom(rng);
  }
  let c = Math.sqrt(-2 * Math.log(r) / r);
  v_val = v * c;  // cache this for next function call for efficiency
  return_v = true;
  return u * c;
};

// return random normal number
function randn(rng: () => number, mu: number, std: number) {
  return mu + gaussRandom(rng) * std;
};

// utilitity that creates contiguous vector of zeros of size n
function zeros(n: number): Float64Array {
  return new Float64Array(n);
};

// utility that returns a matrix filled with random numbers
// generated by the provided generator.
function randnMatrix(n: number, d: number, rng: () => number) {
  let nd = n * d;
  let x = zeros(nd);
  for (let i = 0; i < nd; ++i) {
    x[i] = randn(rng, 0.0, 1E-4);
  }
  return x;
};

// utility that returns a matrix filled with the provided value.
function arrayofs(n: number, d: number, val: number) {
  let x: number[][] = [];
  for (let i = 0; i < n; ++i) {
    x.push(d === 3 ? [val, val, val] : [val, val]);
  }
  return x;
};

// compute (p_{i|j} + p_{j|i})/(2n)
function nearest2P(
    nearest: {index: number, dist: number}[][], perplexity: number,
    tol: number) {
  let N = nearest.length;
  let Htarget = Math.log(perplexity);  // target entropy of distribution
  let P = zeros(N * N);                // temporary probability matrix
  let K = nearest[0].length;
  let pRow: number[] = new Array(K);  // pij[].

  for (let i = 0; i < N; ++i) {
    let neighbors = nearest[i];
    let betaMin = -Infinity;
    let betaMax = Infinity;
    let beta = 1;  // initial value of precision
    let maxTries = 50;

    // perform binary search to find a suitable precision beta
    // so that the entropy of the distribution is appropriate
    let numTries = 0;
    while (true) {
      // compute entropy and kernel row with beta precision
      let psum = 0.0;
      for (let k = 0; k < neighbors.length; ++k) {
        let neighbor = neighbors[k];
        let pij = (i === neighbor.index) ? 0 : Math.exp(-neighbor.dist * beta);
        pij = Math.max(pij, MIN_POSSIBLE_PROB);
        pRow[k] = pij;
        psum += pij;
      }
      // normalize p and compute entropy
      let Hhere = 0.0;
      for (let k = 0; k < pRow.length; ++k) {
        pRow[k] /= psum;
        let pij = pRow[k];
        if (pij > 1E-7) {
          Hhere -= pij * Math.log(pij);
        };
      }

      // adjust beta based on result
      if (Hhere > Htarget) {
        // entropy was too high (distribution too diffuse)
        // so we need to increase the precision for more peaky distribution
        betaMin = beta;  // move up the bounds
        if (betaMax === Infinity) {
          beta = beta * 2;
        } else {
          beta = (beta + betaMax) / 2;
        }

      } else {
        // converse case. make distrubtion less peaky
        betaMax = beta;
        if (betaMin === -Infinity) {
          beta = beta / 2;
        } else {
          beta = (beta + betaMin) / 2;
        }
      }
      numTries++;
      // stopping conditions: too many tries or got a good precision
      if (numTries >= maxTries || Math.abs(Hhere - Htarget) < tol) {
        break;
      }
    }

    // copy over the final prow to P at row i
    for (let k = 0; k < pRow.length; ++k) {
      let pij = pRow[k];
      let j = neighbors[k].index;
      P[i * N + j] = pij;
    }
  }  // end loop over examples i

  // symmetrize P and normalize it to sum to 1 over all ij
  let N2 = N * 2;
  for (let i = 0; i < N; ++i) {
    for (let j = i + 1; j < N; ++j) {
      let i_j = i * N + j;
      let j_i = j * N + i;
      let value = (P[i_j] + P[j_i]) / N2;
      P[i_j] = value;
      P[j_i] = value;
    }
  }
  return P;
};

// helper function
function sign(x: number) {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

function computeForce_2d(
    force: number[], mult: number, pointA: number[], pointB: number[]) {
  force[0] += mult * (pointA[0] - pointB[0]);
  force[1] += mult * (pointA[1] - pointB[1]);
}

function computeForce_3d(
    force: number[], mult: number, pointA: number[], pointB: number[]) {
  force[0] += mult * (pointA[0] - pointB[0]);
  force[1] += mult * (pointA[1] - pointB[1]);
  force[2] += mult * (pointA[2] - pointB[2]);
}

export interface TSNEOptions {
  /** How many dimensions. */
  dim: number;
  /** Roughly how many neighbors each point influences. */
  perplexity?: number;
  /** Learning rate. */
  epsilon?: number;
  /** A random number generator. */
  rng?: () => number;
}

export class TSNE {
  private perplexity: number;
  private epsilon: number;
  /** Random generator */
  private rng: () => number;
  private iter = 0;
  private Y: Float64Array;
  private N: number;
  private P: Float64Array;
  private gains: number[][];
  private ystep: number[][];
  private nearest: {index: number, dist: number}[][];
  private dim: number;
  private dist2: (a: number[], b: number[]) => number;
  private computeForce:
      (force: number[], mult: number, pointA: number[],
       pointB: number[]) => void;

  constructor(opt: TSNEOptions) {
    opt = opt || {dim: 2};
    this.perplexity = opt.perplexity || 30;
    this.epsilon = opt.epsilon || 10;
    this.rng = opt.rng || Math.random;
    this.dim = opt.dim;
    if (opt.dim === 2) {
      this.dist2 = dist2_2D;
      this.computeForce = computeForce_2d;
    } else if (opt.dim === 3) {
      this.dist2 = dist2_3D;
      this.computeForce = computeForce_3d;
    } else {
      throw new Error('Only 2D and 3D is supported');
    }
  }

  // this function takes a fattened distance matrix and creates
  // matrix P from them.
  // D is assumed to be provided as an array of size N^2.
  initDataDist(nearest: {index: number, dist: number}[][]) {
    let N = nearest.length;
    this.nearest = nearest;
    this.P = nearest2P(nearest, this.perplexity, 1E-4);
    this.N = N;
    this.initSolution();  // refresh this
  }

  // (re)initializes the solution to random
  initSolution() {
    // generate random solution to t-SNE
    this.Y = randnMatrix(this.N, this.dim, this.rng);  // the solution
    this.gains = arrayofs(this.N, this.dim, 1.0);      // step gains
    // to accelerate progress in unchanging directions
    this.ystep = arrayofs(this.N, this.dim, 0.0);  // momentum accumulator
    this.iter = 0;
  }

  // return pointer to current solution
  getSolution() { return this.Y; }

  // perform a single step of optimization to improve the embedding
  step() {
    this.iter += 1;
    let N = this.N;

    let grad = this.costGrad(this.Y);  // evaluate gradient

    // perform gradient step
    let ymean = this.dim === 3 ? [0, 0, 0] : [0, 0];
    for (let i = 0; i < N; ++i) {
      for (let d = 0; d < this.dim; ++d) {
        let gid = grad[i][d];
        let sid = this.ystep[i][d];
        let gainid = this.gains[i][d];

        // compute gain update
        let newgain = sign(gid) === sign(sid) ? gainid * 0.8 : gainid + 0.2;
        if (newgain < 0.01) {
          newgain = 0.01;  // clamp
        }
        this.gains[i][d] = newgain;  // store for next turn

        // compute momentum step direction
        let momval = this.iter < 250 ? 0.5 : 0.8;
        let newsid = momval * sid - this.epsilon * newgain * grad[i][d];
        this.ystep[i][d] = newsid;  // remember the step we took

        // step!
        let i_d = i * this.dim + d;
        this.Y[i_d] += newsid;
        ymean[d] += this.Y[i_d];  // accumulate mean so that we
                                  // can center later
      }
    }

    // reproject Y to be zero mean
    for (let i = 0; i < N; ++i) {
      for (let d = 0; d < this.dim; ++d) {
        this.Y[i * this.dim + d] -= ymean[d] / N;
      }
    }
  }

  // return cost and gradient, given an arrangement
  costGrad(Y: Float64Array): number[][] {
    let N = this.N;
    let P = this.P;

    // Trick that helps with local optima.
    let alpha = this.iter < 100 ? 4 : 1;

    // Make data for the SP tree.
    let points: number[][] = new Array(N);  // (x, y)[]
    for (let i = 0; i < N; ++i) {
      let iTimesD = i * this.dim;
      let row = new Array(this.dim);
      for (let d = 0; d < this.dim; ++d) {
        row[d] = Y[iTimesD + d];
      }
      points[i] = row;
    }

    // Make a tree.
    let tree = new SPTree(points);
    let root = tree.root as AugmSPNode;
    // Annotate the tree.

    let annotateTree =
        (node: AugmSPNode): {numCells: number, yCell: number[]} => {
          let numCells = 1;
          if (node.children == null) {
            // Update the current node and tell the parent.
            node.numCells = numCells;
            node.yCell = node.point;
            return {numCells, yCell: node.yCell};
          }
          // node.point is a 2 or 3-dim number[], so slice() makes a copy.
          let yCell = node.point.slice();
          for (let i = 0; i < node.children.length; ++i) {
            let child = node.children[i];
            if (child == null) {
              continue;
            }
            let result = annotateTree(child as AugmSPNode);
            numCells += result.numCells;
            for (let d = 0; d < this.dim; ++d) {
              yCell[d] += result.yCell[d];
            }
          }
          // Update the node and tell the parent.
          node.numCells = numCells;
          node.yCell = yCell.map(v => v / numCells);
          return {numCells, yCell};
        };

    // Augment the tree with more info.
    annotateTree(root);
    tree.visit((node: AugmSPNode, low: number[], high: number[]) => {
      node.rCell = high[0] - low[0];
      return false;
    });
    // compute current Q distribution, unnormalized first
    let grad: number[][] = [];
    let Z = 0;
    let forces: [number[], number[]][] = new Array(N);
    for (let i = 0; i < N; ++i) {
      let pointI = points[i];
      // Compute the positive forces for the i-th node.
      let Fpos = this.dim === 3 ? [0, 0, 0] : [0, 0];
      let neighbors = this.nearest[i];
      for (let k = 0; k < neighbors.length; ++k) {
        let j = neighbors[k].index;
        let pij = P[i * N + j];
        let pointJ = points[j];
        let squaredDistItoJ = this.dist2(pointI, pointJ);
        let premult = pij / (1 + squaredDistItoJ);
        this.computeForce(Fpos, premult, pointI, pointJ);
      }
      // Compute the negative forces for the i-th node.
      let FnegZ = this.dim === 3 ? [0, 0, 0] : [0, 0];
      tree.visit((node: AugmSPNode) => {
        let squaredDistToCell = this.dist2(pointI, node.yCell);
        // Squared distance from point i to cell.
        if (node.children == null ||
            (squaredDistToCell > 0 &&
             node.rCell / Math.sqrt(squaredDistToCell) < THETA)) {
          let qijZ = 1 / (1 + squaredDistToCell);
          let dZ = node.numCells * qijZ;
          Z += dZ;
          dZ *= qijZ;
          this.computeForce(FnegZ, dZ, pointI, node.yCell);
          return true;
        }
        // Cell is too close to approximate.
        let squaredDistToPoint = this.dist2(pointI, node.point);
        let qijZ = 1 / (1 + squaredDistToPoint);
        Z += qijZ;
        qijZ *= qijZ;
        this.computeForce(FnegZ, qijZ, pointI, node.point);
        return false;
      }, true);
      forces[i] = [Fpos, FnegZ];
    }
    // Normalize the negative forces and compute the gradient.
    const A = 4 * alpha;
    const B = 4 / Z;
    for (let i = 0; i < N; ++i) {
      let [FPos, FNegZ] = forces[i];
      let gsum = new Array(this.dim);
      for (let d = 0; d < this.dim; ++d) {
        gsum[d] = A * FPos[d] - B * FNegZ[d];
      }
      grad.push(gsum);
    }
    return grad;
  }
}
