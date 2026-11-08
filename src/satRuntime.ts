import engineSource from 'logic-solver/minisat.js?raw';
import wrapperSource from 'logic-solver/minisat_wrapper.js?raw';
import logicSource from 'logic-solver/logic-solver.js?raw';
import underscore from 'underscore';
import type Logic from 'logic-solver';

// MiniSat's generated asm.js is sensitive to numeric-literal rewriting by
// bundlers. Evaluate the pinned package sources verbatim, using only these
// explicitly supplied modules. No puzzle/user text is evaluated as code.
function load(source: string, dependencies: Record<string, unknown> = {}): unknown {
  const module = { exports: {} };
  const require = (name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected SAT dependency: ${name}`);
    return dependencies[name];
  };
  new Function('module', 'exports', 'require', source)(module, module.exports, require);
  return module.exports;
}
const engine = load(engineSource);
const wrapper = load(wrapperSource, { './minisat.js': engine, underscore });
export default load(logicSource, { './minisat_wrapper.js': wrapper, underscore }) as typeof Logic;
