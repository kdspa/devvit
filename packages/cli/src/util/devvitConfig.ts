import { writeFile } from 'node:fs/promises';
import { validateConfig } from '../vendor/@reddit/json-config/0.4.2/index.js';
import * as v from '../vendor/@reddit/json-config/0.4.2/validators.js';

import { isFile } from '@devvit/dev-server/server/io/file-util.js';
import type { JSONObject } from '@devvit/shared-types/json.js';
import path from 'path';
import { dumpJsonToYaml, readYamlToJson } from './files.js';

const DEVVIT_CONFIG_FILE = 'devvit.yaml';

function getConfigFilepath(projectPath: string): string {
  return path.join(projectPath, DEVVIT_CONFIG_FILE);
}

export type DevvitConfig = {
  // name of the project
  name: string;
  // unique identifier of the project
  slug?: string;
  // DevvitVersion
  version: string;
};

export const DEVVIT_CONFIG_SCHEMA = {
  name: v.string,
  slug: v.optional(v.string, undefined),
  version: v.string,
};

export async function readDevvitConfig(projectPath: string): Promise<DevvitConfig> {
  const configFilePath = getConfigFilepath(projectPath);
  if (!(await isFile(configFilePath))) {
    throw new Error(`Devvit.yaml does not exist`);
  }
  const configJSON = await readYamlToJson(configFilePath);

  // delete packageManager from config if it exists
  if (configJSON.packageManager != null) {
    delete configJSON.packageManager;
    await writeFile(configFilePath, dumpJsonToYaml(configJSON));
  }

  try {
    const validatedConfig = validateConfig(configJSON, DEVVIT_CONFIG_SCHEMA);

    return {
      ...validatedConfig,
      slug: validatedConfig.slug?.toLowerCase(),
      name: validatedConfig.name.toLowerCase(),
    };
  } catch (err) {
    throw new Error(`Invalid Devvit.yaml config format. ${err}`);
  }
}

export async function updateDevvitConfig(
  projectPath: string,
  updates: Partial<DevvitConfig>
): Promise<void> {
  const config = await readDevvitConfig(projectPath);
  if (updates.name != null) {
    config.name = updates.name.toLowerCase();
  }

  if (updates.version != null) {
    config.version = updates.version;
  }

  if (updates.slug != null) {
    config.slug = updates.slug.toLowerCase();
  }

  validateConfig(config as unknown as JSONObject, DEVVIT_CONFIG_SCHEMA);

  const newConfigYaml = dumpJsonToYaml(config);
  await writeFile(getConfigFilepath(projectPath), newConfigYaml);
}

export async function generateDevvitConfig(
  projectPath: string,
  config: DevvitConfig
): Promise<void> {
  const configFilePath = getConfigFilepath(projectPath);

  const oldConfigExists = await isFile(configFilePath);
  const oldConfig: DevvitConfig = oldConfigExists ? await readYamlToJson(configFilePath) : {};

  const newConfigJSON = merge(oldConfig, config) as unknown as JSONObject;
  validateConfig(newConfigJSON, DEVVIT_CONFIG_SCHEMA);

  const newConfigYaml = dumpJsonToYaml(newConfigJSON);

  await writeFile(configFilePath, newConfigYaml);
}

/**
 * @description utility function that shallow merges two objects. rhs will overwrite lhs obj whenever keys clash upon shallow comparison
 */
function merge<L, R>(lhsObj: Readonly<L>, rhsObj: Readonly<R>): L & R {
  return {
    ...lhsObj,
    ...rhsObj,
  };
}
