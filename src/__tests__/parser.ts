import { parse, Configuration, UserDefinedEnvironment } from "../index";
const fs = require("fs");
const path = require('path');

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
    const result = parse([], {
      "test": {
        name: "not-test",
        type: "b",
      },
      config: {
        name: "config",
        type: "R",
        defaultValue: {},
      },
    }, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("option names must match");
  });

  test("simple arguments", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        alias: "c",
        defaultValue: {},
        description: "Provide a configuration",
        optional: true,
      }
    };
    const result = parse(["arg1"], config, globalEnv);
    expect(result).toMatchSnapshot("simple argument");
  });

  test("duplicate aliases", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: {},
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
        defaultValue: {},
        alias: "c",
      },
      bad: {
        name: "bad",
        // @ts-ignore: this is on purpose
        type: "z"
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("bad option flag type");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("bad config flag type");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("validate array of strings");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("validate array of numbers");
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
        type: "n",
        defaultValue: "test",
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("validate number flag");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("validate string flag");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("validate executable flag");
  });

  test("when regex option default is not regex", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
        defaultValue: {},
        alias: "c",
      },
      test: {
        name: "test",
        type: "r",
        defaultValue: 1,
      },
    };
    const result = parse([], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("regex default value error");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("array of numbers wrong type");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("array of strings wrong type");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("invalid boolean default value");
  });

  test("rest args", () => {
    const config: Configuration = {
      config: {
        name: "config",
        type: "R",
      },
    };
    const result = parse(["--", "rest!", "one", "two", "three"], config, globalEnv);
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("not passing an argument to a flag that requires another argument");
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
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("already provided flag");
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
    const result = parse([
      "--test1", "true",
      "--test2", "false",
    ], config, globalEnv);
    expect(filter(result, ["values", "diagnostics"])).toMatchSnapshot("parsing true and false strings with boolean flags");
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
      }
    };
    const result = parse([
      "--test",
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("array parameter with argument missing");
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
      }
    };
    const result = parse([
      "--test", "--b"
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("array parameter with argument missing, next is a flag");
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
      }
    };
    const result = parse([
      "--test", "--"
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("string array arguemnts invalid");
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
      }
    };
    const result = parse([
      "--test", "one,two,three"
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("string array success");
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
      }
    };
    const result = parse([
      "--test", "this should work"
    ], config, globalEnv);
    expect(filter(result, ["diagnostics", "values"])).toMatchSnapshot("string arguments");
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
      }
    };
    const result = parse([
      "--test", "--"
    ], config, globalEnv);
    expect(filter(result, ["diagnostics"])).toMatchSnapshot("string arguments fail");
  });
});
