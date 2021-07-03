import { help, parse, UserDefinedConfigration } from "../index";

const exampleConfig: UserDefinedConfigration = {
  config: {
    name: "config",
    type: "R",
    description: "A user passed configuration location",
  },

  test1: {
    name: "test1",
    type: "b",
    description: "A boolean flag",
  },
  nodesc: {
    name: "nodesc",
    type: "s",
  },
};

test("help text", () => {
  const result = parse([], exampleConfig, {
    cwd: process.cwd(),
    readFileSync(name: string, basename: string): string | null {
      return null;
    },
  });
  const helpText = help(result, {});
  expect(result.diagnostics).toMatchSnapshot("help text diagnostics");
  expect(helpText).toMatchSnapshot("help text");
});
