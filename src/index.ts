import * as util from "./util";
import { ConfigurationDiagnosticMessage } from "./diag";
import glob from "glob";
import path from "path/posix";

export * from "./util";

export type UserDefinedConfigration = Record<
  string,
  util.ConfigurationOptionDefinition
>;
export type UserDefinedEnvironment = {
  cwd: string;
  readFileSync(file: string, basename: string): string | null;
};
export function parse(
  argv: string[],
  config: UserDefinedConfigration,
  env: UserDefinedEnvironment,
): util.ConfigurationState {
  // create the resulting configuration state
  const result = new util.ConfigurationState(config);

  // validate the state of the configuration
  requiredOption("config", config, result);
  validateDefintionNames(result);
  validateAliases(result);
  validateConfigurationTypes(result);
  validateConfigurationDefaultValues(result);
  if (result.diagnostics.length > 0) return result;

  // tokenize the argv input
  const cliTokens = tokenizeInput(argv, result);
  resolveCliProvidedOptions(cliTokens, result, env);

  // use default config option, and get the module if it exists
  const configLocation = resolveDefaultOptionValue(result, env, "config");

  if (configLocation.value) {
    const configLocationValue =
      configLocation.value as util.ConfigurationRequire;
    const configModuleAbsoluteLocation = path.join(
      configLocationValue.basedir,
      configLocationValue.filename,
    );
    let configModule = configLocationValue.getModule();
    // if there's a configuration
    if (configModule) {
      // validate the shape and values
      validateConfigModuleShape(
        configModule,
        configModuleAbsoluteLocation,
        result,
        env,
      );
      validateConfigModuleOptionValues(
        configModule,
        configModuleAbsoluteLocation,
        result,
      );
      if (result.diagnostics.length > 0) return result;

      // mutable config directory (for later use with extension)
      let configDir = path.dirname(configModuleAbsoluteLocation);

      // if this configuration provides any unset values, set them
      resolveUnsetOptionsFromConfigModule(configModule, result);

      // if there is a config extension
      while (configModule.extends) {
        // locate it
        const extendedConfigFileLocation = path.join(
          configDir,
          configModule.extends,
        );
        const extendedConfigFileDir = path.dirname(extendedConfigFileLocation);

        try {
          configModule = require(extendedConfigFileLocation);
        } catch (_ex) {
          break;
        }

        // validate shape and values
        validateConfigModuleShape(
          configModule,
          extendedConfigFileLocation,
          result,
          env,
        );
        validateConfigModuleOptionValues(
          configModule,
          extendedConfigFileLocation,
          result,
        );
        if (result.diagnostics.length > 0) return result;

        // set the unset values and check for configuration extension
        resolveUnsetOptionsFromConfigModule(configModule, result);
        configDir = extendedConfigFileDir;
      }
    }
  }

  resolveDefaultUnprovidedValues(result, env);
  return result;
}

function resolveDefaultUnprovidedValues(result: util.ConfigurationState, env: UserDefinedEnvironment): void {
  for (const name of result.optionsByName.keys()) {
    resolveDefaultOptionValue(result, env, name);
  }
}

function requiredOption(
  name: string,
  config: UserDefinedConfigration,
  result: util.ConfigurationState,
) {
  const optionDefintion = config[name];

  // validate there is a config option
  if (!optionDefintion) {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_100_Invalid_Configuration_Option_Required,
        [name],
      ),
    );
  }
}

function validateDefintionNames(result: util.ConfigurationState): void {
  const config = result.config;
  for (const entry of Object.entries(config)) {
    const [name, configDefinition] = entry;
    if (name !== configDefinition.name) {
      result.diagnostics.push(
        util.diag(
          ConfigurationDiagnosticMessage.ASP_101_Invalid_Configuration_Option_Does_Not_Match,
          [name, configDefinition.name],
        ),
      );
    }
  }
}

function validateAliases(result: util.ConfigurationState): void {
  const config = result.config;
  const aliasMap = new Map<string, string>();
  for (const entry of Object.entries(config)) {
    const [name, option] = entry;
    if (option.alias) {
      const alias = option.alias;
      if (aliasMap.has(alias)) {
        result.diagnostics.push(
          util.diag(
            ConfigurationDiagnosticMessage.ASP_102_Invalid_Configuration_Option_Duplicate_Alias_Found,
            [name, aliasMap.get(alias)!, alias],
          ),
        );
      } else {
        aliasMap.set(alias, name);
      }
    }
  }
}

function validateConfigurationTypes(result: util.ConfigurationState): void {
  const config = result.config;
  const flagSet = util.configurationFlagTypeSet;
  for (const entry of Object.entries(config)) {
    const [name, option] = entry;
    if (!flagSet.has(option.type)) {
      result.diagnostics.push(
        util.diag(
          ConfigurationDiagnosticMessage.ASP_103_Invalid_Configuration_Option_Bad_Option_Flag_Type,
          [name, option.type],
        ),
      );
    }
  }

  const configOption = config.config;
  if (configOption && configOption.type !== "R") {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_104_Invalid_Configuration_Option_Unexpected_Option_Flag_Type,
        ["config", configOption.type, "R"],
      ),
    );
  }
}

function validateConfigurationDefaultValues(
  result: util.ConfigurationState,
): void {
  const config = result.config;
  for (const entry of Object.entries(config)) {
    const [name, configOption] = entry;
    if (configOption.hasOwnProperty("defaultValue")) {
      switch (configOption.type) {
        case "S":
        case "G":
        case "F": {
          assertArrayOfStringsDefaultValue(
            configOption.defaultValue,
            name,
            result,
          );
          continue;
        }
        case "N": {
          assertArrayOfNumbersDefaultValue(
            configOption.defaultValue,
            name,
            result,
          );
          continue;
        }
        case "s":
        case "f":
        case "g": {
          assertStringDefaultValue(configOption.defaultValue, name, result);
          continue;
        }
        case "n": {
          assertNumberDefaultValue(configOption.defaultValue, name, result);
          continue;
        }
        case "e": {
          assertFunctionDefaultValue(configOption.defaultValue, name, result);
          continue;
        }
        case "R":
        case "o": {
          // we don't have a way of validating this default value
          continue;
        }
        case "b": {
          assertBooleanDefaultValue(configOption.defaultValue, name, result);
          continue;
        }
        case "r": {
          assertRegExpDefaultValue(configOption.defaultValue, name, result);
          continue;
        }
      }
    }
  }
}

function assertArrayOfNumbersDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (val instanceof Array) {
    for (const child of val) {
      assertNumberDefaultValue(child, name, result);
    }
  } else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "Array"],
      ),
    );
  }
}

function assertArrayOfStringsDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (val instanceof Array) {
    for (const child of val) {
      assertStringDefaultValue(child, name, result);
    }
  } else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "Array"],
      ),
    );
  }
}

function assertNumberDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "number") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "Number"],
      ),
    );
  }
}

function assertBooleanDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "boolean") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "Boolean"],
      ),
    );
  }
}

function assertRegExpDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (val instanceof RegExp) return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "RegExp"],
      ),
    );
  }
}

function assertFunctionDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "function") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "Function"],
      ),
    );
  }
}

function assertStringDefaultValue(
  val: any,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "string") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type,
        [name, Object.prototype.toString.call(val).slice(8, -1), "String"],
      ),
    );
  }
}

function tokenizeInput(
  argv: string[],
  config: util.ConfigurationState,
): util.ConfigurationArgvToken[] {
  const result = [] as util.ConfigurationArgvToken[];
  const optionsByName = config.optionsByName;
  const optionsByAlias = config.optionsByAlias;
  const configValues = config.values;

  let rest = false;
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    // if we hit the "--" already
    if (rest) {
      result.push({
        option: null,
        type: util.ConfigurationArgvTokenType.Rest,
        value: arg,
      });
      continue;
    }

    // obtain the option being parsed
    let option: util.ConfigurationOptionDefinition | null = null;
    let name: string | null = null;
    if (arg.startsWith("--")) {
      if (arg == "--") {
        rest = true;
        continue;
      }
      name = arg.slice(2);
      option = optionsByName.get(name) || null;
    } else if (arg.startsWith("-")) {
      name = arg.slice(1);
      option = optionsByAlias.get(name) || null;
    } else {
      // we are a normal argument
      result.push({
        option: null,
        type: util.ConfigurationArgvTokenType.Default,
        value: arg,
      });
      continue;
    }

    // obtain the next argument for parsing sake
    const nextArg: string | null = argv.length <= i + 1 ? null : argv[i + 1];

    // the option was found
    if (option) {
      const value = configValues.get(option);
      if (
        value &&
        value.providedBy !== util.ConfigurationOptionProvidedBy.Unprovided
      ) {
        // it was provided. We should skip it and move onto the next argument
        result.push({
          option,
          type: util.ConfigurationArgvTokenType.AlreadyProvided,
          value: null,
        });
        continue;
      }

      // we can allocate a configuration value now
      configValues.set(option, {
        providedBy: util.ConfigurationOptionProvidedBy.Argv,
        value: null,
      });

      switch (option.type) {
        // we are just tokeninzing the boolean flag
        case "b": {
          let value = "true";
          // assume true unless the next argument is "true" or "false"
          if (nextArg) {
            if (nextArg === "true") {
              i++;
            } else if (nextArg === "false") {
              value = "false";
              i++;
            }
          }
          result.push({
            option,
            type: util.ConfigurationArgvTokenType.Flag,
            value,
          });
          break;
        }

        case "F":
        case "G":
        case "N":
        case "S": {
          // all comma seperated... parse it here
          if (nextArg) {
            // we need to check it
            if (nextArg.startsWith("-")) {
              // there's a problem, it's another flag, or rest arg
              result.push({
                option,
                type: util.ConfigurationArgvTokenType.ArgumentMissing,
                value: null,
              });
              break;
            } else {
              i++;
              result.push({
                option,
                type: util.ConfigurationArgvTokenType.Flag,
                value: nextArg.split(","),
              });
              break;
            }
          } else {
            // there's an error here, next arg must be provided
            result.push({
              option,
              type: util.ConfigurationArgvTokenType.ArgumentMissing,
              value: null,
            });
            break;
          }
        }

        case "R":
        case "f":
        case "g":
        case "n":
        case "r":
        case "s": {
          if (nextArg) {
            // we need to check it
            if (nextArg.startsWith("-")) {
              // there's a problem, it's another flag, or rest arg
              result.push({
                option,
                type: util.ConfigurationArgvTokenType.ArgumentMissing,
                value: null,
              });
              break;
            } else {
              i++;
              result.push({
                option,
                type: util.ConfigurationArgvTokenType.Flag,
                value: nextArg,
              });
              break;
            }
          } else {
            // there's an error here, next arg must be provided
            result.push({
              option,
              type: util.ConfigurationArgvTokenType.Unprovided,
              value: null,
            });
            break;
          }
        }

        case "o":
        case "e": {
          // this is a problem, argv cannot provide this option
          result.push({
            option,
            type: util.ConfigurationArgvTokenType.CannotBePassed,
            value: null,
          });
          break;
        }
      }
    } else {
      result.push({
        option: null,
        type: util.ConfigurationArgvTokenType.UnknownFlag,
        value: name,
      });
    }
  }
  return result;
}

function resolveCliProvidedOptions(
  cliTokens: util.ConfigurationArgvToken[],
  result: util.ConfigurationState,
  env: UserDefinedEnvironment,
): void {
  for (const cliToken of cliTokens) {
    switch (cliToken.type) {
      case util.ConfigurationArgvTokenType.CannotBePassed: {
        result.diagnostics.push(
          util.diag(
            ConfigurationDiagnosticMessage.ASP_204_Invalid_CLI_Argument_Cannot_Be_Passed,
            [cliToken.option!.name, cliToken.option!.type],
          ),
        );
        continue;
      }
      case util.ConfigurationArgvTokenType.Unprovided: {
        result.diagnostics.push(
          util.diag(
            ConfigurationDiagnosticMessage.ASP_202_Invalid_CLI_Argument_Missing,
            [cliToken.option!.name],
          ),
        );
        continue;
      }
      case util.ConfigurationArgvTokenType.AlreadyProvided: {
        result.diagnostics.push(
          util.diag(
            ConfigurationDiagnosticMessage.ASP_200_Invalid_CLI_Argument_Argument_Already_Provided,
            [cliToken.option!.name],
          ),
        );
        continue;
      }
      case util.ConfigurationArgvTokenType.Default: {
        result.args.push(cliToken.value as string);
        continue;
      }
      case util.ConfigurationArgvTokenType.Flag: {
        const option = cliToken.option!;
        const value = result.values.get(option)!;
        // todo: parse flags
        switch (option.type) {
          case "F": {
            // array of files
            fileArrayValue(cliToken.value as string[], env, value);
            continue;
          }
          case "f": {
            fileValue(cliToken.value as string, env, value);
            continue;
          }
          case "G": {
            globArrayValue(cliToken.value as string[], env, value);
            continue;
          }
          case "g": {
            globValue(cliToken.value as string, env, value);
            continue;
          }
          case "N": {
            value.value = (cliToken.value as string[]).map((e) =>
              parseFloat(e),
            );
            continue;
          }
          case "n": {
            value.value = parseFloat(cliToken.value as string);
            continue;
          }
          case "R": {
            requireValue(cliToken.value as string, env, value);
            continue;
          }
          case "r": {
            value.value = new RegExp(cliToken.value as string);
            continue;
          }
          case "b":
          case "s":
          case "S": {
            value.value = cliToken.value;
            continue;
          }
        }
      }
      case util.ConfigurationArgvTokenType.ArgumentMissing: {
        result.diagnostics.push(
          util.diag(
            ConfigurationDiagnosticMessage.ASP_202_Invalid_CLI_Argument_Missing,
            [cliToken.option!.name],
          ),
        );
        continue;
      }
      case util.ConfigurationArgvTokenType.Rest: {
        result.rest.push(cliToken.value as string);
        continue;
      }
      case util.ConfigurationArgvTokenType.UnknownFlag: {
        result.diagnostics.push(
          util.diag(
            ConfigurationDiagnosticMessage.ASP_201_Invalid_CLI_Argument_Invalid_Flag,
            [cliToken.value as string],
          ),
        );
        continue;
      }
      /* istanbul ignore next */
      default:
        /* istanbul ignore next */
        throw new Error(
          "Invalid CLI Token type. An internal error has occured.",
        );
    }
  }
}

const getModule = (requirePath: string, dirname: string) => () => {
  try {
    return require(path.join(dirname, requirePath));
  } catch (_ex) {
    return null;
  }
};

function requireValue(
  requirePath: string,
  env: UserDefinedEnvironment,
  value: util.ConfigurationOptionValue,
) {
  value.value = {
    filename: "",
    basedir: env.cwd,
    getModule: getModule(requirePath, env.cwd),
  } as util.ConfigurationRequire;
}

function requireDefaultValue(
  requirePath: any,
  env: UserDefinedEnvironment,
  value: util.ConfigurationOptionValue,
) {
  value.value = {
    filename: requirePath,
    basedir: env.cwd,
    getModule: getModule(requirePath, env.cwd),
  } as util.ConfigurationRequire;
}

function globValue(
  globValue: string,
  env: UserDefinedEnvironment,
  value: util.ConfigurationOptionValue,
) {
  const globResult = glob.sync(globValue, {
    cwd: env.cwd,
  });
  value.value = globResult.map((filename) => ({
    basedir: env.cwd,
    filename,
    getContents: () => env.readFileSync(filename, env.cwd),
  })) as util.ConfigurationFile[];
}

function globArrayValue(
  globArray: string[],
  env: UserDefinedEnvironment,
  value: util.ConfigurationOptionValue,
) {
  let files: string[] = [];
  for (const pattern of globArray) {
    const globResult = glob.sync(pattern, {
      cwd: env.cwd,
    });
    files.push(...globResult);
  }
  const result: util.ConfigurationFile[] = [];
  for (const filename of new Set<string>(files)) {
    result.push({
      basedir: env.cwd,
      getContents: () => env.readFileSync(filename, env.cwd),
      filename,
    });
  }
  value.value = result;
}

function fileValue(
  filename: string,
  env: UserDefinedEnvironment,
  value: util.ConfigurationOptionValue,
) {
  const result: util.ConfigurationFile = {
    basedir: env.cwd,
    getContents: () => env.readFileSync(filename, env.cwd),
    filename,
  };
  value.value = result;
}

function fileArrayValue(
  files: string[],
  env: UserDefinedEnvironment,
  value: util.ConfigurationOptionValue,
) {
  const result: util.ConfigurationFile[] = files.map((e) => ({
    basedir: env.cwd,
    getContents: () => env.readFileSync(e, env.cwd),
    filename: e,
  }));
  value.value = result;
}

function resolveDefaultOptionValue(
  result: util.ConfigurationState,
  env: UserDefinedEnvironment,
  name: string,
): util.ConfigurationOptionValue {
  const option = result.optionsByName.get(name)!;
  const value = result.values.get(option) || {
    providedBy: util.ConfigurationOptionProvidedBy.Unprovided,
    value: option.defaultValue,
  };
  if (
    value.providedBy === util.ConfigurationOptionProvidedBy.Unprovided &&
    option.defaultValue !== void 0
  ) {
    value.providedBy = util.ConfigurationOptionProvidedBy.Default;
    switch (option.type) {
      case "F": {
        fileArrayValue(option.defaultValue, env, value);
        break;
      }
      case "f": {
        fileValue(option.defaultValue, env, value);
        break;
      }
      case "G": {
        globArrayValue(option.defaultValue, env, value);
        break;
      }
      case "g": {
        globValue(option.defaultValue, env, value);
        break;
      }
      case "R": {
        requireDefaultValue(option.defaultValue, env, value);
        break;
      }
      default: {
        value.value = option.defaultValue;
        break;
      }
    }
  }
  return value;
}

function validateConfigModuleShape(
  configModule: any,
  absoluteConfigurationPath: string,
  result: util.ConfigurationState,
  env: UserDefinedEnvironment,
) {
  const relativeConfigurationPath = path.relative(env.cwd, absoluteConfigurationPath)
  if (typeof configModule !== "object") {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_300_Invalid_Configuration_Must_Be_An_Object,
        [relativeConfigurationPath],
      ),
    );
    return;
  }

  if (configModule.hasOwnProperty("extends")) {
    if (typeof configModule.extends !== "string") {
      result.diagnostics.push(
        util.diag(
          ConfigurationDiagnosticMessage.ASP_301_Invalid_Configuration_Shape_Type_Expected,
          [
            relativeConfigurationPath,
            "extends",
            "String",
            Object.prototype.toString.call(configModule.extends).slice(8, -1),
          ],
        ),
      );
    }
  }

  if (configModule.hasOwnProperty("options")) {
    if (typeof configModule.options !== "object") {
      result.diagnostics.push(
        util.diag(
          ConfigurationDiagnosticMessage.ASP_301_Invalid_Configuration_Shape_Type_Expected,
          [
            relativeConfigurationPath,
            "options",
            "Object",
            Object.prototype.toString.call(configModule.extends).slice(8, -1),
          ],
        ),
      );
    }
  }
}
function validateConfigModuleOptionValues(
  configModule: any,
  configLocation: string,
  result: util.ConfigurationState,
) {
  if (!configModule) return;
  if (!configModule.options) return;
  for (const providedOptionEntry of Object.entries(configModule.options)) {
    const [providedOptionName, providedOptionValue] = providedOptionEntry;
    const option = result.optionsByName.get(providedOptionName);
    if (!option) {
      result.diagnostics.push(
        util.diag(
          ConfigurationDiagnosticMessage.ASP_303_Invalid_Configuration_Unexpected_Option,
          [configLocation, providedOptionName],
        ),
      );
      continue;
    }

    switch (option.type) {
      case "S":
      case "G":
      case "F": {
        assertArrayOfStringsValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "s":
      case "g":
      case "f": {
        assertStringValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "b": {
        assertBooleanValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "e": {
        assertFunctionValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "o": {
        assertObjectValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "N": {
        assertArrayOfNumbersValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "n": {
        assertNumberValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
      case "r": {
        assertRegExpValue(
          providedOptionValue,
          configLocation,
          providedOptionName,
          result,
        );
        continue;
      }
    }
  }
}

function assertArrayOfStringsValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (val instanceof Array) {
    for (const child of val) {
      assertStringValue(child, configLocation, name, result);
    }
  } else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          configLocation,
          name,
          Object.prototype.toString.call(val).slice(8, -1),
          "Array",
        ],
      ),
    );
  }
}

function assertStringValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "string") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          name,
          configLocation,
          Object.prototype.toString.call(val).slice(8, -1),
          "String",
        ],
      ),
    );
  }
}

function assertBooleanValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "boolean") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          name,
          configLocation,
          Object.prototype.toString.call(val).slice(8, -1),
          "true | false",
        ],
      ),
    );
  }
}

function assertFunctionValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "function") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          name,
          configLocation,
          Object.prototype.toString.call(val).slice(8, -1),
          "function",
        ],
      ),
    );
  }
}

function assertObjectValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "object") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          name,
          configLocation,
          Object.prototype.toString.call(val).slice(8, -1),
          "object",
        ],
      ),
    );
  }
}

function assertArrayOfNumbersValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (val instanceof Array) {
    for (const child of val) {
      assertNumberValue(child, configLocation, name, result);
    }
  } else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          configLocation,
          name,
          Object.prototype.toString.call(val).slice(8, -1),
          "Array",
        ],
      ),
    );
  }
}

function assertNumberValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (typeof val === "number") return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          name,
          configLocation,
          Object.prototype.toString.call(val).slice(8, -1),
          "number",
        ],
      ),
    );
  }
}

function assertRegExpValue(
  val: any,
  configLocation: string,
  name: string,
  result: util.ConfigurationState,
): void {
  if (val instanceof RegExp) return;
  else {
    result.diagnostics.push(
      util.diag(
        ConfigurationDiagnosticMessage.ASP_304_Invalid_Configuration_Option_Type,
        [
          name,
          configLocation,
          Object.prototype.toString.call(val).slice(8, -1),
          "RegExp",
        ],
      ),
    );
  }
}

function resolveUnsetOptionsFromConfigModule(
  configModule: any,
  result: util.ConfigurationState,
) {
  if (configModule.options) {
    for (const entry of Object.entries(configModule.options)) {
      const [providedOptionName, providedOptionValue] = entry;
      const option = result.optionsByName.get(providedOptionName);
      if (!option) continue;
      const value = result.values.get(option);
      if (!value)
        throw new Error("Invalid state: value does not exist for option.");
      if (value.providedBy === util.ConfigurationOptionProvidedBy.Unprovided) {
        value.providedBy = util.ConfigurationOptionProvidedBy.Config;
        value.value = providedOptionValue;
      }
    }
  }
}
