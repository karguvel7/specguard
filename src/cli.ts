#!/usr/bin/env node
import { Command } from 'commander';
import { checkSpecs } from './detector.js';
import { renderReport, shouldFail } from './report.js';
import type { FailOn, ReportFormat } from './types.js';

const program = new Command();

program
  .name('specguard')
  .description('Detect OpenAPI breaking changes between two specs')
  .version('1.0.0');

program
  .command('check')
  .description('Compare base and head OpenAPI documents')
  .requiredOption('--base <path>', 'Base (previous) spec path or URL')
  .requiredOption('--head <path>', 'Head (candidate) spec path or URL')
  .option('--format <format>', 'Output format: text or json', 'text')
  .option('--fail-on <level>', 'Fail on: error, warning, or never', 'error')
  .action(async (opts: { base: string; head: string; format: string; failOn: string }) => {
    const format = opts.format as ReportFormat;
    const failOn = opts.failOn as FailOn;
    if (format !== 'text' && format !== 'json') {
      console.error('Invalid --format (use text or json)');
      process.exit(2);
    }
    if (!['error', 'warning', 'never'].includes(failOn)) {
      console.error('Invalid --fail-on (use error, warning, or never)');
      process.exit(2);
    }
    try {
      const result = await checkSpecs({ base: opts.base, head: opts.head });
      process.stdout.write(renderReport(result, { format, failOn }));
      if (shouldFail(result, failOn)) {
        process.exit(1);
      }
      process.exit(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      process.exit(2);
    }
  });

program.parseAsync(process.argv).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(2);
});
