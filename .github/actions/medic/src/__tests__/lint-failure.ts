/**
 * Lint Failure Test File
 * 
 * This file contains intentional lint violations that are only flagged
 * when FAIL_LINT=true environment variable is set.
 * 
 * When FAIL_LINT=true, ESLint will report errors for:
 * - console.log statements (no-console)
 * - var declarations (no-var)  
 * - eval usage (no-eval)
 * - unused variables (@typescript-eslint/no-unused-vars)
 */

export function lintFailureDemo(): void {
  console.log('This console.log violates no-console rule');
  
  var x = 1;
  
  eval('console.log("This eval violates no-eval rule")');
  
  const unusedVariable = 'This variable is never used';
  
  console.warn('Another console statement');
  
  var y = 2;
  var z = x + y;
  
  console.error('Final console statement', z);
}
