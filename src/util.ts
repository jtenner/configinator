import { ConfigurationDiagnosticMessage } from "./diag";
export type ConfigurationOptionType =
  | "g"
  | "G" // glob and comma sepperated glob
  | "s"
  | "S" // string and comma seperated string
  | "n"
  | "N" // number and comma seperated number
  | "f"
  | "F" // file and comma seperated list of files
  | "r" // regex
  | "R" // require
  | "b" // simple boolean flag
  | "o"
  | "e"; // provided only by config file, 'o' is object, 'e' is executable function
export type ConfigurationOptionAlias =
  | "a"
  | "A"
  | "b"
  | "B"
  | "c"
  | "C"
  | "d"
  | "D"
  | "e"
  | "E"
  | "f"
  | "F"
  | "g"
  | "G"
  | "h"
  | "H"
  | "i"
  | "I"
  | "j"
  | "J"
  | "k"
  | "K"
  | "l"
  | "L"
  | "m"
  | "M"
  | "n"
  | "N"
  | "o"
  | "O"
  | "p"
  | "P"
  | "q"
  | "Q"
  | "r"
  | "R"
  | "s"
  | "S"
  | "t"
  | "T"
  | "u"
  | "U"
  | "v"
  | "V"
  | "w"
  | "W"
  | "x"
  | "X"
  | "y"
  | "Y"
  | "z"
  | "Z";

export const configurationFlagTypeSet = new Set<ConfigurationOptionAlias>([
  "g",
  "G", // glob and comma sepperated glob
  "s",
  "S", // string and comma seperated string
  "n",
  "N", // number and comma seperated number
  "f",
  "F", // file and comma seperated list of files
  "r", // regex
  "R", // require
  "b",
  "o",
  "e",
]); // object or executable function in config file

export type ConfigurationOptionDefinition = {
  name: string;
  alias?: ConfigurationOptionAlias;
  type: ConfigurationOptionType;
  optional?: boolean;
  description?: string | string[];
  defaultValue?: any;
  required?: boolean;
};

export type Configuration = Record<string, ConfigurationOptionDefinition> & {
  config: ConfigurationOptionDefinition;
};

export enum ConfigurationOptionProvidedBy {
  Unprovided,
  Config,
  Argv,
}

export type ConfigurationOptionValue = {
  providedBy: ConfigurationOptionProvidedBy;
  value: any;
};

export interface ConfigurationTree {
  config: any;
  extends: ConfigurationTree | null;
}

export class ConfigurationState {
  constructor(public config: Record<string, ConfigurationOptionDefinition>) {
    const optionsByName = this.optionsByName;
    const options = this.values;
    const optionsByAlias = this.optionsByAlias;

    for (const entry of Object.entries(config)) {
      const configOption = entry[1];
      optionsByName.set(configOption.name, configOption);
      if (configOption.alias)
        optionsByAlias.set(configOption.alias, configOption);
      options.set(configOption, {
        providedBy: ConfigurationOptionProvidedBy.Unprovided,
        value: null,
      });
    }
  }

  public args: string[] = [];
  public rest: string[] = [];
  public optionsByAlias = new Map<string, ConfigurationOptionDefinition>();
  public optionsByName = new Map<string, ConfigurationOptionDefinition>();
  public values = new Map<
    ConfigurationOptionDefinition,
    ConfigurationOptionValue
  >();
  public configTree: ConfigurationTree | null = null;
  public argv: string[] | null = null;
  public diagnostics: string[] = [];
}

export type CLIArgument = {
  option: ConfigurationOptionDefinition;
  value: ConfigurationFile | string;
};

export function diag(
  message: ConfigurationDiagnosticMessage,
  options: string[],
): string {
  return message.replace(
    /\{[0-9]+\}/g,
    (msg: string) => options[parseInt(msg.slice(1, -1))],
  );
}

export enum ConfigurationArgvTokenType {
  Default,
  Flag,
  Rest,
  UnknownFlag,
  AlreadyProvided,
  ArgumentMissing,
  Unprovided,
  CannotBePassed,
}

export type ConfigurationArgvToken = {
  option: ConfigurationOptionDefinition | null;
  type: ConfigurationArgvTokenType;
  value: boolean | number | string | string[] | null;
};

export type ConfigurationFile = {
  basedir: string;
  getContents(): string | null;
  filename: string;
};

export type ConfigurationRequire = {
  basedir: string;
  getModule(): any;
  filename: string;
};
