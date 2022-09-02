/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { execute } from "@yarnpkg/shell";
import {PassThrough} from 'stream';
import readdirp from 'readdirp';
import shell from "shelljs";
import { Platform } from "./config";
import { Logger } from "./logger";


export class WritableBuffer extends PassThrough {
  #chunks: Buffer[] = [];

  constructor() {
    super();
    this.on(`data`, chunk => {
      this.#chunks.push(chunk);
    });
  }

  getText(): string {
    return Buffer.concat(this.#chunks).toString('utf8');
  }
}

export async function executeCommandAndCaptureOutput(command: string): Promise<{result: number, output: string }> {
  const outputBuffer = new WritableBuffer();
  const result = await execute(command, [], {
    stdin: null,
    stdout: outputBuffer,
    stderr: outputBuffer
  });

  const output = outputBuffer.getText();
  return {result, output};
}

export async function pruneEmptyDirectories(directoryPath: string): Promise<void> {
  const dirEntries = await readdirp.promise(directoryPath, { type: "directories", depth: 1 });
  for (const dirEntry of dirEntries) {
    await pruneEmptyDirectories(dirEntry.fullPath);
  }

  const allEntries = await readdirp.promise(directoryPath, { type: "files_directories", depth: 1 });
  if (Array.from(allEntries).length === 0) {
    shell.rm('-rf', directoryPath);
  }
}

export function getPlatform(): Platform {
  switch(process.platform) {
    case "win32":
      return "windows";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

export function isValidPlatform(name: string): boolean {
  return ['macos', 'linux', 'windows'].includes(name);
}

export async function checkWhichCommand(commandName: string, logger: Logger): Promise<boolean> {
  const {result, output } = await executeCommandAndCaptureOutput(`which ${commandName}`);
  if (result === 0) {
    logger.checkOk(`Found '${commandName}' command at: ${output.trim()}`);
    return true;
  } else {
    logger.checkError(`Unable to run 'which ${commandName}'. Command reported: ${output}`);
    return false;
  }
}
