/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import path from "node:path";
import shell from "shelljs";
import { FetchConfig } from "./config.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { executeCommandAndCaptureOutput } from "./utils.js";

const GIT_SOURCE_DIR = "git_source";


export class FetchStep {
  #config: FetchConfig;
  #gitSourceDirectory: string = null;

  constructor(config: FetchConfig) {
    this.#config = config;
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    logger.subsection("Fetch step");
    const gitUrl = this.#config.gitUrl;
    const commands = this.#config.commands;
    if (gitUrl == null && commands == null) {
      logger.checkError(`Neither 'gitUrl' nor 'commands' were specified in the 'build' block.`);
      return false;
    }
    if (gitUrl != null) {
      logger.checkOk(`Will fetch project from git repository at '${gitUrl}'`);

      const {result, output } = await executeCommandAndCaptureOutput('git --version');
      if (result === 0) {
        logger.checkOk(`Found 'git' command version: ${output.trim()}`);
      } else {
        logger.checkError(`Unable to run 'git --version'. Command reported: ${output}`);
        return false;
      }

    } else {
      logger.checkOk(`Will fetch project using commands`);
    }

    return true;
  }

  async describe(): Promise<string> {
    throw new Error("Method not implemented.");
  }

  async execute(logger: Logger, prepareStep: PrepareStep): Promise<boolean> {
    logger.subsection("Fetch step");

    this.#gitSourceDirectory = path.join(prepareStep.getTempDirectory(), GIT_SOURCE_DIR);

    shell.cd(prepareStep.getTempDirectory());
    const command = `git clone --depth 1 ${this.#config.gitUrl} ${GIT_SOURCE_DIR}`;
    logger.info(`Cloning repository with command '${command}'`)

    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }

    return true;
  }

  getSourceDirectory(): string {
    return this.#gitSourceDirectory;
  }
}
