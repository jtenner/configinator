# configinator

Need a cli argv parser that handles config js files? Look no further.

# usage

```
npm install --save configinator
```

Then in your typescript code:

```ts
import { parse, Configuration } from "configinator";
import path from "path";
import fs from "fs";

const myConfig: Configuration = {
  // the config flag is always required
  config: {
    name: "config", // must match the property name!
    type: "R", // node require
    defaultValue: "my-cli.config.js", // a default location
  },

  // a boolean flag
  bool: {
    name: "bool",
    type: "b", // true or false
    defaultValue: false,
  },
};

// remove the first two arguments in node which are the node process and entry file
const configState = parse(proces.argv.slice(2), myConfig, {
  cwd: process.cwd(),
  // can return anything, but it's best to use this particular method in most cases
  readFileSync(file: string, baseDir: string): string | null {
    const filePath = path.join(baseDir, file);
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (ex) {
      return null;
    }
  },
});
```

# features

This argv parser has the following features:

If `configinator` accepts a configuration that is malformed it will report diagnostic errors.

- if a duplicate alias for a given option is found
- if the `"name"` property for a given option does not match
- if the `"config"` property is not set correctly
- if the flag types are not configured correctly
- if default values are not the right type

If the end user passes invalid cli flags, argv is malformed, or if the configuration object is invalid, then it will report diagnostics for each of these obvious problems.

- invalid option flag values
- option is missing
- executable or object flags cannot be provided via the cli

If a configuration file is specified, then it will traverse the file tree and validate options inside that configuration. The following diagnostics are also emitted for configuration files.

- bad option types in config files
- badly shaped config files
- configuration cannot be extended (because it doesn't exist)

Also, anything after a `--` is concatenated to the `result.rest` string array.

# configuration objects

A configuration object has two properties. An `options` property and a `extends` property.

```ts
module.exports = {
  options: {
    // put your options here
  },
  extends: "path/to/some/configuration/file.js",
};
```

If a configuration is malformed with bad options or it has the wrong shape, then a diagnostic will be emitted to describe the problem.

# retrieving configuration values

The process keeps track of a lot of meta-data and it's not intuitive how options should be retrieved. Retreive your options by using the following pattern.

```ts
import {
  parse,
  ConfigurationOptionValue,
  ConfigurationResult,
} from "configinator";

function getOptionByName(
  result: ConfigurationResult,
  name: string,
): ConfigurationOptionValue {
  if (!result.optionsByName.has(name))
    throw new Error(`Cannot find option '${name}'`);
  const option = result.optionsByName.get(name)!;
  // the values map uses options as keys, not strings
  return result.values.get(option)!;
}

const result = parse(process.argv.slice(2), myConfig, myEnv);

// use the helper function
const value = getOptionByName(result, "option-name");

// we can see how the option was provided, and it's value:
console.log(
  `Option "option-name" is ${value.value} and was provided by ${
    ConfigurationOptionProvidedBy[value.providedBy]
  }`,
);
```

# configuration types

There are different kinds of configuration option types and they behave differently in the cli and in configuration objects.

## "b" flag type

The simple boolean flag usually represents a flag that when passed, it results
in a `true` value. In configinator you can also provide false values.

Given the following config (without the required options):

```ts
const config = {
  bool: {
    name: "bool",
    type: "b",
    decription: "A boolean flag",
    defaultValue: false, // recommended default value for booleans
  },
};
```

It can be passed via CLI in the following ways:

```
node myCli.js --bool
node myCli.js --bool true
node myCli.js --bool false
```

In a configuration object, it can be passed like this:

```ts
module.exports = {
  options: {
    bool: true, // or false
  },
};
```

## "S" and "s" flags

`String` `"s"` and `String[]` `"S"` option types accept a string parameter.

```
node mycli.js --string-flag 'some string here'
```

When inside a configuration object it must be a string value.

```ts
module.exports {
  options: {
    "string-flag": "some string here",
  },
};
```

## "F" and "f" flags

This type of option represents files to be obtained from the file system. `"F"` is an array of files and `"f"` is a single file.

Files are always relative to the working directory, or in the case of config files, they are relative to the configuration file's directory.

```ts
// this is how files are configured
const config: Configuration = {
  files: {
    name: "files",
    type: "F", // comma seperated list
    // defaultValue: ["one.txt", "two.txt", "three.txt"],
  },
  "single-file": {
    name: "single-file",
    type: "f", // single file
    // defaultValue: "someFilePath.txt",
  },
};
```

When parsed via cli input:

```
node myCli.js --single-file someFilePath.txt --files one.txt,two.txt,three.txt
```

When provided in a configuration file:

```ts
module.exports = {
  options: {
    // "f" flag
    "single-file": "someFilePath.txt",
    // "F" flag
    files: ["one.txt", "two.txt", "three.txt"],
  },
};
```

When obtaining a value for these flags, it will look like this:

```ts
export type ConfigurationFile = {
  basedir: string;
  getContents(): string | null;
  filename: string;
};
```

Calling the `getContents()` function will call the `env.readFileSync(file, baseDir)` function. This allows you to decide if you need the file contents, or just the file name and base directory.

## "G" and "g" flags

This type of option represents files to be obtained from the file system that match the given patterns. `"G"` is an array of glob quieries and `"f"` is a single glob query.

Files are always relative to the working directory, or in the case of config files, they are relative to the configuration file's directory.

```ts
// this is how globs are configured
const config: Configuration = {
  globs: {
    name: "globs",
    type: "G", // comma seperated list
    // defaultValue: ["*.txt", "*.js", "*.ts"],
  },
  "single-glob": {
    name: "single-glob",
    type: "g", // single glob
    // defaultValue: "*.txt",
  },
};
```

When parsed via cli input:

```
node myCli.js --single-glob *.txt --globs *.js,*.ts,*.tsx
```

When provided in a configuration file:

```ts
module.exports = {
  options: {
    // "g" flag
    "single-glob": "someFilePath.txt",
    // "S" flag
    globs: ["*.ts", "*.js", "*.tsx"],
  },
};
```

When obtaining a value for these flags, it will look like this:

```ts
export type ConfigurationFile = {
  basedir: string;
  getContents(): string | null;
  filename: string;
};
```

Calling the `getContents()` function will call the `env.readFileSync(file, baseDir)` function. This allows you to decide if you need the file contents, or just the file name and base directory.

## "N" and "n" flags

This type of option represents number values, or array of numbers. All numbers will be parsed as float values.

```ts
// this is how globs are configured
const config: Configuration = {
  numbers: {
    name: "numbers",
    type: "N", // comma seperated list
    // defaultValue: [1, 2, 3],
  },
  "single-number": {
    name: "single-number",
    type: "n", // single number
    // defaultValue: 5,
  },
};
```

When parsed via cli input:

```
node myCli.js --single-number 42 --globs 1,2,3
```

When provided in a configuration file:

```ts
module.exports = {
  options: {
    // "g" flag
    "single-number": 42,
    // "S" flag
    numbers: [1, 2, 3],
  },
};
```

## "e" and "o" flags

The `"e"` flag represents an executable function, wheras the `"o"` flag represents anything that returns `true` with the `typeof val === "object"` condition. This allows `null` values.

```ts
const config: Configuration = {
  executable: {
    name: "executable",
    type: "e",
    // defaultValue: () => {},
  },
  object: {
    name: "object",
    type: "o",
    // defaultValue: {}
  },
};
```

These options cannot be passed via the command line, and will emit diagnostics at runtime if they are passed.

Passing them via a config looks like this.

```ts
module.exports = {
  options: {
    executable: () => {},
    object: {},
  },
};
```

# "r" flag

Regular Expression objects via cli are passed using the `"r"` option type.

```ts
module.exports = {
  regex: {
    name: "regex",
    type: "R",
    // defaultValue: /./,
  },
};
```

When passed via the cli, it generates a regular expression with no option flags.

```sh
# calls, new RegExp(str)
node myCli.js --regex .*
```

When passed via config object, it needs to be an `instanceof RegExp`.

```ts
module.exports = {
  regex: /./,
};
```

# License

```
The MIT License (MIT)
Copyright ?? 2021 Joshua Tenner <tenner.joshua@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the ???Software???), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED ???AS IS???, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
