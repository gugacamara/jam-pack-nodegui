/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export type Platform = 'macos' | 'linux' | 'windows';

export interface Command {
  platform?: string | string[];
  command: string;
}

export type CommandLine = string;

export type Commands = (Command | CommandLine)[];

export interface PrepareConfig {
  tempDirectory?: string;
}

export interface FetchConfig {
  gitUrl?: string;
  gitBranch?: string;
  postFetch?: Commands; // TODO
}

export interface BuildConfig {
  skip?: boolean;
  packageManager?: string;
  scriptName?: string;
  postBuild?: Commands;
}

export interface PruneConfig {
  patterns?: FilePattern[];
  postPrune?: Commands;  // TODO
}

export interface FilePattern {
  keep?: string[];
  delete?: string[];
  platform?: string | string[];
}

export interface AddLauncherConfig {
  skip?: boolean;
  jsEntryPoint: string;
}

export interface ZipConfig {
  skip?: boolean;
  platforms?: string[];
  prePack?: Commands;
}

export interface DebianConfig {
  skip?: boolean;
  controlFields?: {[key: string]: string};
  prePack?: Commands;
}

export interface NSISConfig {
  skip?: boolean;
  prePack?: Commands;
  companyName?: string;
  description?: string;
  detailColors?: string;
  appTitle?: string;
}

export interface Config {
  prepare: PrepareConfig;
  fetch: FetchConfig;
  build: BuildConfig;
  prune: PruneConfig;
  addLauncher?: AddLauncherConfig;
  zip?: ZipConfig;
  debian?: DebianConfig;
  nsis?: NSISConfig;
}
