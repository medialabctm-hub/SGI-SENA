/**
 * Regression checks for committed environment examples.
 *
 * These examples must never carry a concrete Railway database endpoint or
 * port. Real values belong in the local environment or Railway variables.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from '@jest/globals';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const environmentFiles = [
  'env.example',
  'env.local.example',
  'src/.env.example',
  '../README.md',
  '../Documentation/DEPLOY_RAILWAY.md',
];

const assignmentPattern =
  /^(?:#\s*)?(DB_HOST|MYSQLHOST|DB_PORT|MYSQLPORT)\s*=\s*([^#\s]*)/i;

function readEnvironmentExamples() {
  return environmentFiles.map(relativePath => ({
    path: relativePath,
    content: fs.readFileSync(path.join(backendRoot, relativePath), 'utf8'),
  }));
}

function getDatabaseEndpointAssignments(content) {
  return content.split(/\r?\n/).flatMap((line, index) => {
    const match = line.trim().match(assignmentPattern);
    if (!match) return [];

    return [
      {
        key: match[1].toUpperCase(),
        value: match[2],
        line: index + 1,
      },
    ];
  });
}

describe('environment examples', () => {
  it('uses placeholders for every non-local database host and port assignment', () => {
    for (const { content } of readEnvironmentExamples()) {
      for (const assignment of getDatabaseEndpointAssignments(content)) {
        if (assignment.key.endsWith('HOST')) {
          const isLocalHost = /^(?:localhost|127\.0\.0\.1|db)$/i.test(
            assignment.value
          );
          const isRailwayVariableReference = /^\$\{\{[^}]+\}\}$/i.test(
            assignment.value
          );
          const isPlaceholder =
            /^(?:$|tu[-_]|your[-_]|<|.*\.example(?:$|:))/i.test(
              assignment.value
            );

          expect(
            isLocalHost || isRailwayVariableReference || isPlaceholder
          ).toBe(true);
        }

        if (assignment.key.endsWith('PORT')) {
          const isLocalPort = assignment.value === '3306';
          const isRailwayVariableReference = /^\$\{\{[^}]+\}\}$/i.test(
            assignment.value
          );
          const isPlaceholder =
            /^(?:$|tu[-_]|your[-_]|<|.*\.example(?:$|:))/i.test(
              assignment.value
            );

          expect(
            isLocalPort || isRailwayVariableReference || isPlaceholder
          ).toBe(true);
        }
      }
    }
  });
});
