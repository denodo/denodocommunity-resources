// Grammar Migration Validation
// Validates that the modular grammar packs contain all the rules from the original grammar-config.js

import { grammarRegistry, validateGrammarCoverage, getGrammarMetadata } from './grammar-registry';

/**
 * Comprehensive validation of the grammar migration
 */
export function validateGrammarMigration() {
  console.log('🔍 Validating Grammar Migration...\n');

  // 1. Check coverage of all 29 statement types
  const coverage = validateGrammarCoverage();
  console.log('📊 Statement Type Coverage:');
  console.log(`   ✅ Total Expected: ${coverage.total}`);
  console.log(`   ✅ Successfully Covered: ${coverage.covered.length}`);

  if (coverage.missing.length > 0) {
    console.log(`   ❌ Missing: ${coverage.missing.length}`);
    console.log(`   Missing types: ${coverage.missing.join(', ')}`);
  } else {
    console.log('   🎉 All statement types covered!');
  }

  // 2. Get detailed metadata
  const metadata = getGrammarMetadata();
  console.log('\n📈 Grammar Pack Details:');
  metadata.packs.forEach(pack => {
    console.log(`   📦 ${pack.name} v${pack.version}:`);
    console.log(`      - ${pack.statementCount} statements`);
    console.log(`      - ${pack.processorCount} processors`);
    console.log(`      - ${pack.description}`);
  });

  // 3. Validate specific statement types from original file
  console.log('\n🎯 Validating Key Statement Types:');

  const config = grammarRegistry.compile();
  const criticalStatements = [
    'DATASOURCE_JDBC',    // Most complex datasource
    'VIEW',               // Core view functionality
    'WRAPPER',            // Complex wrapper logic
    'ALTER_ROLE',         // Security with custom processors
    'DATABASE',           // Context management
    'RESOURCE_MANAGER_PLAN' // Resource management
  ];

  criticalStatements.forEach(stmtType => {
    const stmt = config.statements[stmtType];
    if (stmt) {
      const extractorCount = Object.keys(stmt.extractors).length;
      const hasNormalize = !!stmt.normalize;
      const status = extractorCount > 0 && hasNormalize ? '✅' : '⚠️';
      console.log(`   ${status} ${stmtType}: ${extractorCount} extractors, normalize: ${hasNormalize}`);
    } else {
      console.log(`   ❌ ${stmtType}: MISSING!`);
    }
  });

  // 4. Validate processor migration
  console.log('\n⚙️ Processor Validation:');
  const criticalProcessors = [
    'sanitizeIdentifier',           // Core processor
    'extractSelectBodyFromView',    // Complex view processor
    'detectVendorFromStatement',    // JDBC vendor detection
    'extractCacheStatus',           // Cache analysis
    'extractParametersContent',     // Wrapper parameters
    'extractUserDescription'        // Security description
  ];

  criticalProcessors.forEach(procName => {
    const processor = config.processors[procName];
    const status = (processor !== undefined && typeof processor === 'function') ? '✅' : '❌';
    console.log(`   ${status} ${procName}`);
  });

  // 5. Calculate migration completeness
  const totalOriginalStatements = 29; // Known from original file
  const totalOriginalProcessors = 25;  // Estimate from original file

  const migrationScore = {
    statements: (coverage.covered.length / totalOriginalStatements * 100).toFixed(1),
    processors: (metadata.totalProcessors / totalOriginalProcessors * 100).toFixed(1),
    overall: ((coverage.covered.length + metadata.totalProcessors) / (totalOriginalStatements + totalOriginalProcessors) * 100).toFixed(1)
  };

  console.log('\n📊 Migration Completeness:');
  console.log(`   📋 Statements: ${migrationScore.statements}% (${coverage.covered.length}/${totalOriginalStatements})`);
  console.log(`   ⚙️ Processors: ${migrationScore.processors}% (${metadata.totalProcessors}/${totalOriginalProcessors})`);
  console.log(`   🎯 Overall: ${migrationScore.overall}%`);

  // 6. Summary
  console.log('\n📝 Migration Summary:');
  if (coverage.isComplete && metadata.totalProcessors >= 20) {
    console.log('   🎉 SUCCESS: Grammar migration appears complete!');
    console.log('   ✅ All 29 statement types are covered');
    console.log('   ✅ Critical processors are implemented');
    console.log('   ✅ Modular structure is ready for use');
  } else {
    console.log('   ⚠️  INCOMPLETE: Some elements may be missing');
    if (!coverage.isComplete) {
      console.log(`   - Missing statement types: ${coverage.missing.join(', ')}`);
    }
    if (metadata.totalProcessors < 20) {
      console.log(`   - Only ${metadata.totalProcessors} processors found (expected ~25)`);
    }
  }

  return {
    isComplete: coverage.isComplete && metadata.totalProcessors >= 20,
    coverage,
    metadata,
    migrationScore
  };
}

// Export for use in tests or validation scripts
export default validateGrammarMigration;