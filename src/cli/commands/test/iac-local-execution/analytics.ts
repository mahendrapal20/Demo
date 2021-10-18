import { FormattedResult } from './types';
import * as analytics from '../../../../lib/analytics';
import { calculatePercentage } from './math-utils';
import { makeDirectoryIterator } from '../../../../lib/iac/makeDirectoryIterator';
import path = require('path');
import { LOCAL_POLICY_ENGINE_DIR } from './local-cache';

export function addIacAnalytics(
  formattedResults: FormattedResult[],
  /* eslint-disable @typescript-eslint/no-unused-vars */
  ignoredIssuesCount: number,
) {
  let totalIssuesCount = 0;
  const customRulesIdsFoundInIssues: { [customRuleId: string]: true } = {};
  let issuesFromCustomRulesCount = 0;
  const issuesByType: Record<string, object> = {};
  const packageManagers = Array<string>();

  const customRules = getRegoRulesFroBundle(LOCAL_POLICY_ENGINE_DIR);
  const customRulesCount = customRules.length;

  formattedResults.forEach((res) => {
    totalIssuesCount =
      (totalIssuesCount || 0) + res.result.cloudConfigResults.length;

    const packageManagerConfig = res.packageManager;
    packageManagers.push(packageManagerConfig);

    res.result.cloudConfigResults.forEach((policy) => {
      issuesByType[packageManagerConfig] =
        issuesByType[packageManagerConfig] ?? {};
      issuesByType[packageManagerConfig][policy.severity] =
        (issuesByType[packageManagerConfig][policy.severity] || 0) + 1;

      if (policy.isGeneratedByCustomRule) {
        issuesFromCustomRulesCount++;
        customRulesIdsFoundInIssues[policy.publicId] = true;
        issuesByType['custom'] = issuesByType['custom'] ?? {};
        issuesByType['custom'][policy.severity] =
          (issuesByType['custom'][policy.severity] || 0) + 1;
      }
    });
  });

  const uniqueCustomRulesCount: number = Object.keys(
    customRulesIdsFoundInIssues,
  ).length;

  analytics.add('packageManager', Array.from(new Set(packageManagers)));
  analytics.add('iac-issues-count', totalIssuesCount);
  analytics.add('iac-ignored-issues-count', ignoredIssuesCount);
  analytics.add('iac-type', issuesByType);
  analytics.add('iac-metrics', performanceAnalyticsObject);
  analytics.add('iac-test-count', formattedResults.length);
  analytics.add('iac-custom-rules-issues-count', issuesFromCustomRulesCount);
  analytics.add(
    'iac-custom-rules-issues-percentage',
    calculatePercentage(issuesFromCustomRulesCount, totalIssuesCount),
  );
  analytics.add('iac-custom-rules-count', customRulesCount);
  analytics.add(
    'iac-custom-rules-percentage',
    calculatePercentage(uniqueCustomRulesCount, customRulesCount),
  );
  analytics.add('iac-custom-rules-coverage-count', uniqueCustomRulesCount);
}

export enum PerformanceAnalyticsKey {
  InitLocalCache = 'cache-init-ms',
  FileLoading = 'file-loading-ms',
  FileParsing = 'file-parsing-ms',
  FileScanning = 'file-scanning-ms',
  OrgSettings = 'org-settings-ms',
  CustomSeverities = 'custom-severities-ms',
  ResultFormatting = 'results-formatting-ms',
  UsageTracking = 'usage-tracking-ms',
  CacheCleanup = 'cache-cleanup-ms',
  Total = 'total-iac-ms',
}

export const performanceAnalyticsObject: Record<
  PerformanceAnalyticsKey,
  number | null
> = {
  [PerformanceAnalyticsKey.InitLocalCache]: null,
  [PerformanceAnalyticsKey.FileLoading]: null,
  [PerformanceAnalyticsKey.FileParsing]: null,
  [PerformanceAnalyticsKey.FileScanning]: null,
  [PerformanceAnalyticsKey.OrgSettings]: null,
  [PerformanceAnalyticsKey.CustomSeverities]: null,
  [PerformanceAnalyticsKey.ResultFormatting]: null,
  [PerformanceAnalyticsKey.UsageTracking]: null,
  [PerformanceAnalyticsKey.CacheCleanup]: null,
  [PerformanceAnalyticsKey.Total]: null,
};

function getRegoRulesFroBundle(pathToScan: string): string[] {
  const directoryPaths = makeDirectoryIterator(pathToScan, {
    extension: '.rego',
  }); // todo: maxdepth

  const customRules: string[] = [];
  for (const filePath of directoryPaths) {
    if (filePath.includes('lib/')) {
      continue;
    }
    // The SDK creates a folder with the same publicId as the rule
    // So the folder name should be the same as the publicId
    customRules.push(path.basename(path.dirname(filePath)));
  }
  return customRules;
}
