import { parse, Configuration, UserDefinedEnvironment, ConfigurationState } from "../index";
const fs = require("fs");
const path = require("path");

function snapshotValues(result: ConfigurationState): void {
  for (const optionValuePair of result.values) {
    const [option, value] = optionValuePair;
    switch (option.type) {
      case "F": {
        let i = 0;
        for (const file of value.value) {
          expect(file.getContents()).toMatchSnapshot(`${option.name} - file ${i++}`);
        }
        continue;
      }
      case "f": {
        expect(value.value.getContents()).toMatchSnapshot(`${option.name} - file`);
        continue;
      }
      case "R": {
        expect(value.value ? value.value.getModule() : null).toMatchSnapshot(`${option.name} - module`);
        continue;
      }
      case "G":
      case "g": {
        let i = 0;
        for (const file of value.value) {
          expect(file.getContents()).toMatchSnapshot(`${option.name} - glob ${i++}`);
        }
        continue;
      }
      default: {
        expect(value.value).toMatchSnapshot(`${option.name}`);
        continue;
      }
    }
  }
}

const globalEnv = {
  cwd: process.cwd(),
  readFileSync: (file: string, basename: string) => {
    const filePath = path.join(basename, file);
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf8");
    return null;
  },
} as UserDefinedEnvironment;

function filter(obj: any, keys: string[]): any {
  const result = {} as any;
  for (const entry of Object.entries(obj)) {
    const [key, value] = entry;
    if (keys.includes(key)) {
      result[key] = value;
    }
  }
  return result;
}

describe("parser", () => {
  test("config is required", () => {
    const result = parse([], {}, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("config required");
  });

  test("options must match names", () => {
    const result = parse(
      [],
      {
        test: {
          name: "not-test",
          type: "b",
        },
        config: {
          name: "config",
          type: "R",
          defaultValue: "src/__test_files__/default.config.js",
        },
      },
      globalEnv,
    );
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "option names must match",
    );
  });

  test("simple arguments", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        alias: "c",
        defaultValue: "src/__test_files__/default.config.js",
        description: "Provide a configuration",
        optional: true,
      },
    };

    const result = parse(["arg1"], config, globalEnv);
    expect(filter(result, ["args", "diagnostics"])).toMatchSnapshot("simple argument");
  });

  test("duplicate aliases", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
        alias: "c",
      },
      duplicate: {
        name: "duplicate",
        type: "s",
        alias: "c",
        defaultValue: "duplicate alias",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("duplicate alias");
  });

  test("bad option flag type", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
        alias: "c",
      },
      bad: {
        name: "bad",
        // @ts-ignore: this is on purpose
        type: "z",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "bad option flag type",
    );
  });

  test("bad config flag type", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "b",
        defaultValue: true,
        alias: "c",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "bad config flag type",
    );
  });

  test("array of strings default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "b",
        defaultValue: true,
        alias: "c",
      },
      test: {
        name: "test",
        type: "S",
        defaultValue: 1,
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "validate array of strings",
    );
  });

  test("array of numbers default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "b",
        defaultValue: true,
        alias: "c",
      },
      test: {
        name: "test",
        type: "N",
        defaultValue: "test",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "validate array of numbers",
    );
  });

  test("number type flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
        alias: "c",
      },
      test: {
        name: "test",
        type: "n",
        defaultValue: "test",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "validate number flag",
    );
  });

  test("number type flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "b",
        defaultValue: true,
        alias: "c",
      },
      test: {
        name: "test",
        type: "s",
        defaultValue: 1,
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "validate string flag",
    );
  });

  test("executable type flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "b",
        defaultValue: true,
        alias: "c",
      },
      test: {
        name: "test",
        type: "e",
        defaultValue: 1,
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "validate executable flag",
    );
  });

  test("when regex option default is not regex", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
        alias: "c",
      },
      test: {
        name: "test",
        type: "r",
        defaultValue: 1,
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "regex default value error",
    );
  });

  test("array of numbers default value when default value is an array, but also incorrect", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: {},
        alias: "c",
      },
      test: {
        name: "test",
        type: "N",
        defaultValue: ["oops", "wrong", "type"],
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "array of numbers wrong type",
    );
  });

  test("array of string default value when default value is an array, but also incorrect", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: {},
        alias: "c",
      },
      test: {
        name: "test",
        type: "S",
        defaultValue: [1, 2, 3],
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "array of strings wrong type",
    );
  });

  test("invalid boolean value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: {},
        alias: "c",
      },
      test: {
        name: "test",
        type: "b",
        defaultValue: "incorrect!",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "invalid boolean default value",
    );
  });

  test("rest args", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
    };
    const result = parse(
      ["--", "rest!", "one", "two", "three"],
      config,
      globalEnv,
    );
    expect(filter(result, ["rest"])).toMatchSnapshot("rest args");
  });

  test("flag that requires another argument in the wrong position", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        alias: "t",
        type: "s",
      },
    };
    const result = parse(["-t"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "not passing an argument to a flag that requires another argument",
    );
  });

  test("already provided flags", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        alias: "t",
        type: "s",
      },
    };
    const result = parse(["-t", "blah", "-t", "meh"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "already provided flag",
    );
  });

  test("parsing true and false strings", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test1: {
        name: "test1",
        type: "b",
      },
      test2: {
        name: "test2",
        type: "b",
      },
    };
    const result = parse(
      ["--test1", "true", "--test2", "false"],
      config,
      globalEnv,
    );
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "parsing true and false strings with boolean flags",
    );
    snapshotValues(result);
  });

  test("parsing string array argument missing", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        type: "S",
      },
    };
    const result = parse(["--test"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "array parameter with argument missing",
    );
  });

  test("parsing string array argument missing, next is a flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        type: "S",
      },
      b: {
        name: "b",
        type: "b",
      },
    };
    const result = parse(["--test", "--b"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "array parameter with argument missing, next is a flag",
    );
  });

  test("parsing string array error", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        type: "S",
      },
    };
    const result = parse(["--test", "--"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "string array arguemnts invalid",
    );
  });

  test("parsing string array success", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        type: "S",
      },
    };
    const result = parse(["--test", "one,two,three"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "string array success",
    );
  });

  test("string parameters", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        type: "s",
      },
    };
    const result = parse(["--test", "this should work"], config, globalEnv);
    expect(filter(result, ["diagnostics", "values"])).toMatchSnapshot(
      "string arguments",
    );
  });

  test("string parameters fail", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      test: {
        name: "test",
        type: "s",
      },
    };
    const result = parse(["--test", "--"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot(
      "string arguments fail",
    );
  });

  test("o and e flags can't be passed via argv", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
      o: {
        name: "o",
        type: "o",
      },
      e: {
        name: "e",
        type: "e",
      },
    };
    const result = parse(["--e", "--o"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("o and e flags");
  });

  test("unknown flags passed via argv", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      }
    };
    const result = parse(["--unknown"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("unknown flag");
  });

  test("obtaining file values", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      file: {
        name: "file",
        type: "f",
      },
    };
    const result = parse([
      "--file", "src/__test_files__/a.txt",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("file value");
    snapshotValues(result);
  });

  test("obtaining file array values", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      file: {
        name: "file",
        type: "F",
      },
    };
    const result = parse([
      "--file", "src/__test_files__/a.txt,src/__test_files__/b.txt",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("file values");
    snapshotValues(result);
  });

  test("obtaining files via glob", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      file: {
        name: "file",
        type: "g",
      },
    };
    const result = parse([
      "--file", "src/__test_files__/*.txt",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("glob values");
    snapshotValues(result);
  });

  test("obtaining files via glob array", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      file: {
        name: "file",
        type: "G",
      },
    };
    const result = parse([
      "--file", "src/__test_files__/a.txt,src/__test_files__/b.txt",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("glob values");
    snapshotValues(result);
  });

  test("obtaining numbers via N flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      nums: {
        name: "nums",
        type: "N",
      },
    };
    const result = parse([
      "--nums", "1,2,3",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("num diagnostics");
    snapshotValues(result);
  });

  test("obtaining number via n flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      num: {
        name: "num",
        type: "n",
      },
    };
    const result = parse([
      "--num", "1",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("num diagnostics");
    snapshotValues(result);
  });

  test("obtaining module via R flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      val: {
        name: "val",
        type: "n",
        defaultValue: -1,
      },
    };
    const result = parse([
      "--config", "src/__test_files__/example.js",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("R diagnostics");
    snapshotValues(result);
  });

  test("obtaining regex via r flag", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js",
      },
      val: {
        name: "val",
        type: "r",
      },
    };
    const result = parse([
      "--val", ".*",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("R diagnostics");
    snapshotValues(result);
  });

  test("obtaining a config that doesn't exist should return null", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R"
      },
    };
    const result = parse([
      "--config", "src/__test_files__/default2.config.js",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("R diagnostics");
    snapshotValues(result);
  });

  test("F flag default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      files: {
        name: "files",
        type: "F",
        defaultValue: ["src/__test_files__/a.txt", "src/__test_files__/b.txt"],
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("F flag default values");
    snapshotValues(result);
  });

  test("f flag default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      file: {
        name: "file",
        type: "f",
        defaultValue: "src/__test_files__/a.txt",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("f flag default values");
    snapshotValues(result);
  });

  test("g flag default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      file: {
        name: "file",
        type: "g",
        defaultValue: "src/__test_files__/*.txt",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("f flag default values");
    snapshotValues(result);
  });

  test("G flag default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      file: {
        name: "file",
        type: "G",
        defaultValue: ["src/__test_files__/a.txt", "src/__test_files__/b.txt"],
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("G flag default values");
    snapshotValues(result);
  });

  test("n flag default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      num: {
        name: "num",
        type: "n",
        defaultValue: 50,
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("n flag default values");
    snapshotValues(result);
  });

  test("config is not an object", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.not_an_object.js"
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("config is not an object");
    snapshotValues(result);
  });

  test("extends is not a string", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.extends_number.js"
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("config extends number");
    snapshotValues(result);
  });

  test("options is not an object", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.options_number.js"
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("config options number");
    snapshotValues(result);
  });

  test("null configs", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.null.js"
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("null config");
    snapshotValues(result);
  });

  test("invalid config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.invalid_option.js"
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid option config");
    snapshotValues(result);
  });

  test("array of strings option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.array_of_strings.js"
      },
      test: {
        name: "test",
        type: "S",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test array of strings");
    snapshotValues(result);
  });

  test("string option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.string.js"
      },
      test: {
        name: "test",
        type: "s",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test strings");
    snapshotValues(result);
  });

  test("boolean option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.boolean.js"
      },
      test: {
        name: "test",
        type: "b",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test booleans");
    snapshotValues(result);
  });

  test("function option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.function.js"
      },
      test: {
        name: "test",
        type: "e",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test functions");
    snapshotValues(result);
  });

  test("object option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.object.js"
      },
      test: {
        name: "test",
        type: "o",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test objects");
    snapshotValues(result);
  });

  test("array of numbers option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.number_array.js"
      },
      test: {
        name: "test",
        type: "N",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test array of numbers");
    snapshotValues(result);
  });

  test("regex option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.regex.js"
      },
      test: {
        name: "test",
        type: "r",
      }
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test regex");
    snapshotValues(result);
  });

  test("regex default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      test: {
        name: "test",
        type: "r",
        defaultValue: /.*/
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test regex default value");
    snapshotValues(result);
  });

  test("function default value", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      },
      test: {
        name: "test",
        type: "e",
        /* istanbul ignore next */
        defaultValue: () => void 0
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("test function default value");
    snapshotValues(result);
  });

  test("invalid alias", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/default.config.js"
      }
    };
    const result = parse(["-t"], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid alias argument");
  });

  test("invalid array of strings config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        // boolean test value, when it should be an array of strings
        defaultValue: "src/__test_files__/config.boolean.js"
      },
      test: {
        name: "test",
        type: "S",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid array of strings config value");
  });

  test("invalid string config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        // boolean test value, when it should be an array of strings
        defaultValue: "src/__test_files__/config.boolean.js"
      },
      test: {
        name: "test",
        type: "s",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid string value");
  });

  test("invalid boolean config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: "src/__test_files__/config.string.js"
      },
      test: {
        name: "test",
        type: "b",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid boolean value");
  });

  test("invalid function config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        // string test value, but expected function
        defaultValue: "src/__test_files__/config.string.js"
      },
      test: {
        name: "test",
        type: "e",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid function value");
  });

  test("invalid object config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        // string test value, but expected object
        defaultValue: "src/__test_files__/config.string.js"
      },
      test: {
        name: "test",
        type: "o",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid object value");
  });

  test("invalid number array config option", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        // string test value, but expected number array
        defaultValue: "src/__test_files__/config.string.js"
      },
      test: {
        name: "test",
        type: "N",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid number array value");
  });
});
