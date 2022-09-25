/*
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import fs from 'node:fs';
import * as path from "node:path";
import copy from 'recursive-copy';
import shell from "shelljs";

import { BuildStep } from "./buildstep.js";
import { CommandList } from './commandlist.js';
import { DMGConfig } from "./config.js";
import { FetchStep } from "./fetchstep.js";
import { Logger } from "./logger.js";
import { PrepareStep } from "./preparestep.js";
import { PruneStep } from './prunestep.js';
import { checkWhichCommand, getPlatform } from "./utils.js";


export class DmgStep {
  #config: DMGConfig;
  #commandList: CommandList;
  #dmgSourceDirectory = "";
  #dmgResourcesDirectory = "";

  constructor(config: DMGConfig) {
    this.#config = config;
    this.#commandList = new CommandList(config.prePack);
  }

  #isSkip(): boolean {
    return this.#config.skip || getPlatform() !== "macos";
  }

  async preflightCheck(logger: Logger): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("DMG step (skipping)");
      return true;
    }
    logger.subsection("DMG step");

    if (! await checkWhichCommand("hdiutil", logger)) {
      return false;
    }

    if ( ! await this.#commandList.preflightCheck(logger, "prePack")) {
      return false
    }

    return true;
  }

  async execute(logger: Logger, prepareStep: PrepareStep, fetchStep: FetchStep, buildStep: BuildStep, pruneStep: PruneStep): Promise<boolean> {
    if (this.#isSkip()) {
      logger.subsection("DMG step (skipping)");
      return true;
    }
    logger.subsection("DMG step");

    const DMG_SOURCE_NAME = "dmg_source";
    this.#dmgSourceDirectory = path.join(prepareStep.getTempDirectory(), DMG_SOURCE_NAME);

    logger.info("Copying source to DMG directory.");

    shell.mkdir(this.#dmgSourceDirectory);
    const appTitle = buildStep.getApplicationName();
    const appVersion = buildStep.getApplicationVersion();

    shell.mkdir(path.join(this.#dmgSourceDirectory, `${appTitle}.app`));

    shell.cd(this.#dmgSourceDirectory);
    shell.ln("-s", "/Applications", "Applications");

    const volumneIconPath = path.join(__dirname, "../resources/macos/.VolumeIcon.icns");
    shell.cp(volumneIconPath, this.#dmgSourceDirectory);

    shell.mkdir(path.join(this.#dmgSourceDirectory, `.background`));
    const backgroundPath = path.join(__dirname, "../resources/macos/dmg_background.png");
    shell.cp(backgroundPath, path.join(this.#dmgSourceDirectory, ".background/background.png"));
  
    const contentsPath = path.join(this.#dmgSourceDirectory, `${appTitle}.app`, `Contents`);
    shell.mkdir(contentsPath);
    this.#dmgResourcesDirectory = path.join(contentsPath, "Resources");
    shell.mkdir(this.#dmgResourcesDirectory);

    try {
      await copy(fetchStep.getSourcePath(), this.#dmgResourcesDirectory, {
        dot: true,
	      junk: true,
      });
    } catch (error) {
      logger.error('Copy failed: ' + error);
      return false;
    }
   
// sh.mv(path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/main/resources/logo/extraterm_small_logo.icns`),
//     path.join(versionedOutputDir, `${APP_TITLE}.app/Contents/Resources/extraterm.icns`));
      
    const plistContents = this.#getPlistFile(buildStep);
    
    fs.writeFileSync(path.join(contentsPath, "Info.plist"), plistContents, {encoding: 'utf8'});

    const env: { [key: string]: string } = {};
    prepareStep.addVariables(env);
    fetchStep.addVariables(env);
    buildStep.addVariables(env);
    pruneStep.addVariables(env);
    this.addVariables(env);
    if ( ! await this.#commandList.execute(logger, env)) {
      return false;
    }

    const command= `hdiutil create -volname '${appTitle}' -srcfolder '${this.#dmgSourceDirectory}' -ov -format UDZO ` +
                   `'${prepareStep.getTempDirectory()}/${appTitle}_${appVersion}.dmg'`;
    const result = shell.exec(command);
    if (result.code !== 0) {
      logger.error(`Something went wrong while running command '${command}'`);
      return false;
    }

    logger.info(`Created DMG file`);

    return true;
  }

  #getPlistFile(buildStep: BuildStep): string {
    const appTitle = buildStep.getApplicationName();
    const appVersion = buildStep.getApplicationVersion();

    const cfBundleDisplayName = this.#config.cfBundleDisplayName ?? appTitle;
    const cfBundleDevelopmentRegion = this.#config.cfBundleDevelopmentRegion ?? "en";
    const cfBundleExecutable = this.#config.cfBundleExecutable ?? appTitle;
    const cfBundleIdentifier = this.#config.cfBundleIdentifier ?? appTitle;
    const cfBundleName = this.#config.cfBundleName ?? appTitle;
    const cfBundleShortVersionString = this.#config.cfBundleShortVersionString ?? appVersion;
    const cfBundleVersion = this.#config.cfBundleVersion ?? appVersion;
    const nsHumanReadableCopyright = this.#config.nsHumanReadableCopyright ?? "";
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>CFBundleDisplayName</key>
        <string>${xmlEncode(cfBundleDisplayName)}</string>
        <key>CFBundleDevelopmentRegion</key>
        <string>${xmlEncode(cfBundleDevelopmentRegion)}</string>
        <key>CFBundleExecutable</key>
        <string>${xmlEncode(cfBundleExecutable)}</string>
        <key>CFBundleIdentifier</key>
        <string>${xmlEncode(cfBundleIdentifier)}</string>
        <key>CFBundleIconFile</key>
        <string>extraterm.icns</string>
        <key>CFBundleInfoDictionaryVersion</key>
        <string>6.0</string>
        <key>CFBundleName</key>
        <string>${xmlEncode(cfBundleName)}</string>
        <key>CFBundlePackageType</key>
        <string>APPL</string>
        <key>CFBundleShortVersionString</key>
        <string>${xmlEncode(cfBundleShortVersionString)}</string>
        <key>CFBundleVersion</key>
        <string>${xmlEncode(cfBundleVersion)}</string>
        <key>CFBundleSupportedPlatforms</key>
        <array>
        <string>MacOSX</string>
        </array>
        <key>LSMinimumSystemVersion</key>
        <string>10.15</string>
        <key>NSHumanReadableCopyright</key>
        <string>${xmlEncode(nsHumanReadableCopyright)}</string>
        <key>NSHighResolutionCapable</key>
        <string>True</string>
    </dict>
</plist>
`;
  }

  getDMGSourceDirectory(): string {
    return this.#dmgSourceDirectory;
  }

  addVariables(variables: {[key: string]: string}): void {
    variables["dmgStep.dmgSourceDirectory"] = this.getDMGSourceDirectory();
  }
}

function xmlEncode(s: string): string {
  return s;
}
