import { orthogonalNeighbours, type ClueMode } from './puzzle';
import { UNITS, PEERS, CELL_UNITS, sees } from './vendor/sudokui/engine/board';
import { sumEquations, type SumEquation } from './sumEquations';

export type Clues = readonly (number | null)[];
const ALL = 511;
const bit = (d: number) => 1 << (d - 1);
const single = (mask: number) => mask !== 0 && (mask & (mask - 1)) === 0;
const size = (mask: number) => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };

/** Exact finite-domain backtracking. Clues constrain neighbours, never the clue cell.
 * A verified witness can accelerate finding a second solution; uniqueness
 * always requires exhaustive backtracking. No classic uniqueness rules apply.
 */
export class VariantSolver {
  private constraints: { cell: number; neighbours: number[]; tuples: number[][] }[];

  private alternatives: number[][] = [];
  private equationKey = '';
  private equations: SumEquation[] = [];
  constructor(private clues: Clues, private mode: ClueMode, private witness?: readonly number[]) {
    if (clues.length !== 81 || clues.some(c => c !== null && (!Number.isInteger(c) || c < 1))) {
      throw new Error('Expected 81 positive clues or null for missing clues.');
    }
    this.constraints = [];
    if (witness) {
      if (witness.length !== 81 || UNITS.some(unit => new Set(unit.map(c => witness[c])).size !== 9)
        || witness.some(d => !Number.isInteger(d) || d < 1 || d > 9)) throw new Error('Invalid solution witness.');
      for (let a = 1; a <= 8; a++) for (let b = a + 1; b <= 9; b++) {
        const remaining = new Set(witness.flatMap((d, c) => d === a || d === b ? [c] : []));
        while (remaining.size) {
          const component = [remaining.values().next().value!];
          remaining.delete(component[0]);
          for (let i = 0; i < component.length; i++) for (const peer of PEERS[component[i]]) {
            if (remaining.delete(peer)) component.push(peer);
          }
          const alternative = [...witness];
          for (const cell of component) alternative[cell] = witness[cell] === a ? b : a;
          this.alternatives.push(alternative);
        }
      }
    }
    clues.forEach((target, cell) => {
      if (target === null) return;
      const neighbours = orthogonalNeighbours(cell);
      const tuples: number[][] = [];
      const digits: number[] = [];
      const enumerate = (value: number): void => {
        const pos = digits.length;
        if (pos === neighbours.length) {
          if (value === target) tuples.push(digits.map(bit));
          return;
        }
        for (let d = 1; d <= 9; d++) {
          if (digits.some((prev, j) => prev === d && sees(neighbours[j], neighbours[pos]))) continue;
          const next = mode === 'sum' ? value + d : value * d;
          const remaining = neighbours.length - pos - 1;
          if (mode === 'sum' ? next + remaining > target || next + remaining * 9 < target : next > target || target % next !== 0) continue;
          digits.push(d);
          enumerate(next);
          digits.pop();
        }
      };
      enumerate(mode === 'sum' ? 0 : 1);
      this.constraints.push({ cell, neighbours, tuples });
    });
  }

  /** Exact local assignments for explaining clue-based candidate eliminations. */
  clueOptions() { return this.constraints; }

  /** Find a completion from candidate domains, without a generator's solution. */
  solve(domains: Uint16Array): Uint8Array | null {
    if (domains.length !== 81 || domains.some(mask => mask === 0 || mask > ALL)) return null;
    let result: Uint8Array | null = null;
    this.countSolutions(Array<boolean>(81).fill(true), {
      domains, limit: 1, onSolution: values => { result = values; },
    });
    return result;
  }

  /** Return 0, 1 or 2 (two means at least two). Active flags allow cached clue tables during digging. */
  countSolutions(active: readonly boolean[] = Array<boolean>(81).fill(true), options: {
    domains?: Uint16Array; limit?: 1 | 2; onSolution?: (values: Uint8Array) => void;
  } = {}): number {
    const limit = options.limit ?? 2;
    const constraints = this.constraints.filter(c => active[c.cell]);
    const matches = (values: readonly number[]) => constraints.every(c =>
      c.neighbours.reduce((v, cell) => this.mode === 'sum' ? v + values[cell] : v * values[cell], this.mode === 'sum' ? 0 : 1) === this.clues[c.cell]);
    if (this.witness && !matches(this.witness)) throw new Error('Witness does not satisfy the active clues.');
    // Each candidate is a valid Sudoku digit trade. Two actual satisfying
    // assignments are sufficient proof of non-uniqueness, with no guessing.
    if (!options.domains && !options.onSolution && this.witness && this.alternatives.some(matches)) return limit;
    const equationKey = active.map(value => value ? '1' : '0').join('');
    if (this.mode === 'sum' && equationKey !== this.equationKey) {
      this.equations = sumEquations(this.clues, active); this.equationKey = equationKey;
    }
    const equations = this.equations;
    const degree = new Uint8Array(81);
    for (const c of constraints) for (const cell of c.neighbours) degree[cell]++;
    let count = 0;
    const search = (domains: Uint16Array, tables: number[][][]): void => {
      // These signatures are local to this branch, never reused after backtracking.
      const equationStates = equations.map(() => [] as number[]);
      const clueStates = this.mode === 'sum' ? constraints.map(() => [] as number[]) : [];
      const singles = this.mode === 'sum' ? new Uint16Array(81) : undefined;
      let changed = true;
      while (changed) {
        changed = false;
        for (const [ei, { terms, target, tolerance }] of equations.entries()) {
          const state = equationStates[ei];
          if (state.length && terms.every(([cell], j) => state[j] === domains[cell])) continue;
          terms.forEach(([cell], j) => { state[j] = domains[cell]; });
          let min = 0, max = 0;
          const bounds: [number, number][] = [];
          for (const [cell, coefficient] of terms) {
            const mask = domains[cell];
            if (!mask) return;
            const low = 32 - Math.clz32(mask & -mask), high = 32 - Math.clz32(mask);
            const a = coefficient * (coefficient > 0 ? low : high);
            const b = coefficient * (coefficient > 0 ? high : low);
            min += a; max += b; bounds.push([a, b]);
          }
          if (target < min - tolerance || target > max + tolerance) return;
          for (let j = 0; j < terms.length; j++) {
            const [cell, coefficient] = terms[j];
            let allowed = 0;
            for (let mask = domains[cell]; mask; mask &= mask - 1) {
              const digitBit = mask & -mask;
              const value = (32 - Math.clz32(digitBit)) * coefficient;
              if (value + min - bounds[j][0] <= target + tolerance && value + max - bounds[j][1] >= target - tolerance) allowed |= digitBit;
            }
            if (!allowed) return;
            if (allowed !== domains[cell]) { domains[cell] = allowed; changed = true; }
          }
        }
        for (let cell = 0; cell < 81; cell++) {
          const mask = domains[cell];
          if (!mask) return;
          if (!single(mask) || singles?.[cell] === mask) continue;
          if (singles) singles[cell] = mask;
          for (const peer of PEERS[cell]) {
            if (!(domains[peer] & mask)) continue;
            domains[peer] &= ~mask;
            if (!domains[peer]) return;
            changed = true;
          }
        }
        for (const unit of UNITS) {
          // Naked pairs add inexpensive all-different propagation.
          for (let i = 0; i < 9; i++) {
            const mask = domains[unit[i]];
            if (size(mask) !== 2) continue;
            for (let j = i + 1; j < 9; j++) {
              if (domains[unit[j]] !== mask) continue;
              for (let k = 0; k < 9; k++) {
                if (k === i || k === j) continue;
                const cell = unit[k], next = domains[cell] & ~mask;
                if (!next) return;
                if (next !== domains[cell]) { domains[cell] = next; changed = true; }
              }
            }
          }
          for (let digit = 1; digit <= 9; digit++) {
            const mask = bit(digit);
            let last = -1, places = 0;
            for (const cell of unit) if (domains[cell] & mask) { last = cell; places++; }
            if (!places) return;
            if (places === 1 && domains[last] !== mask) { domains[last] = mask; changed = true; }
            if (places >= 2 && places <= 3) {
              const cells = unit.filter(cell => domains[cell] & mask);
              for (const other of CELL_UNITS[last]) {
                if (UNITS[other] === unit || !cells.every(cell => CELL_UNITS[cell].includes(other))) continue;
                for (const cell of UNITS[other]) {
                  if (unit.includes(cell) || !(domains[cell] & mask)) continue;
                  domains[cell] &= ~mask;
                  if (!domains[cell]) return;
                  changed = true;
                }
              }
            }
          }
        }
        for (let ci = 0; ci < constraints.length; ci++) {
          const { neighbours } = constraints[ci];
          const state = clueStates[ci];
          if (state?.length && neighbours.every((cell, j) => state[j] === domains[cell])) continue;
          if (state) neighbours.forEach((cell, j) => { state[j] = domains[cell]; });
          const support = new Uint16Array(neighbours.length);
          const valid: number[][] = [];
          for (const tuple of tables[ci]) {
            let fits = true;
            for (let j = 0; j < neighbours.length; j++) if (!(domains[neighbours[j]] & tuple[j])) { fits = false; break; }
            if (fits) {
              valid.push(tuple);
              for (let j = 0; j < neighbours.length; j++) support[j] |= tuple[j];
            }
          }
          tables[ci] = valid;
          for (let j = 0; j < neighbours.length; j++) {
            const cell = neighbours[j];
            const next = domains[cell] & support[j];
            if (!next) return;
            if (next !== domains[cell]) { domains[cell] = next; changed = true; }
          }
        }
      }
      let best = -1, smallest = 10;
      for (let cell = 0; cell < 81; cell++) {
        const n = size(domains[cell]);
        if (n > 1 && (n < smallest || (n === smallest && degree[cell] > degree[best]))) { best = cell; smallest = n; }
      }
      if (best === -1) {
        count++;
        options.onSolution?.(Uint8Array.from(domains, mask => 32 - Math.clz32(mask)));
        return;
      }
      const choices: number[] = [];
      for (let mask = domains[best]; mask; mask &= mask - 1) choices.push(mask & -mask);
      if (this.witness) choices.sort((a, b) => Number(b === bit(this.witness![best])) - Number(a === bit(this.witness![best])));
      for (const choice of choices) {
        if (count >= limit) break;
        const next = domains.slice();
        next[best] = choice;
        search(next, tables.slice());
      }
    };
    search(options.domains?.slice() ?? new Uint16Array(81).fill(ALL), constraints.map(c => c.tuples));
    return count;
  }
}

export const countVariantSolutions = (clues: Clues, mode: ClueMode) => new VariantSolver(clues, mode).countSolutions();
