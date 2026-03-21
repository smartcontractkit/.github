/**
 * Build Failure Test File
 * 
 * This file contains intentional TypeScript compilation errors.
 * It is renamed to .ts only when FAIL_BUILD=true to trigger build failures.
 * 
 * Errors:
 * - undefined symbols
 * - type mismatches
 * - missing imports
 */

export function buildFailureDemo(): void {
  const result = undefinedSymbol.doSomething();
  
  const value: string = 42;
  
  const data = nonExistentModule.getData();
  
  missingFunction();
  
  const config: { name: string; count: number } = {
    name: 'test',
    count: 'not a number',
  };
  
  console.log(result, value, data, config);
}
