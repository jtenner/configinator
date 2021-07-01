export enum ConfigurationDiagnosticMessage {
  ASP_100_Invalid_Configuration_Option_Required = "Invalid configuration option '--{0}': '--{0}' is always required in user defined definitions",
  ASP_101_Invalid_Configuration_Option_Does_Not_Match = "Invalid configuration option '--{0}': Option key '{0}' does not match name '{1}'",
  ASP_102_Invalid_Configuration_Option_Duplicate_Alias_Found = "Invalid configuration option '--{0}': Option '--{1}' already has alias '-{2}'",
  ASP_103_Invalid_Configuration_Option_Bad_Option_Flag_Type = "Invalid configuration option '--{0}': Option type '{1}' is invalid",
  ASP_104_Invalid_Configuration_Option_Unexpected_Option_Flag_Type = "Invalid configuration option '--{0}': Option type '{1}' is invalid, expected '{2}'",
  ASP_105_Invalid_Configuration_Default_Value_Is_Incorrect_Type = "Invalid configuration option `--{0}`: Default value is type '{1}', expected '{2}'",
  ASP_200_Invalid_CLI_Argument_Argument_Already_Provided = "Invalid CLI argument '--{0}': Option already provided",
  ASP_201_Invalid_CLI_Argument_Invalid_Flag = "Invalid CLI argument '{0}': Option is not valid",
  ASP_202_Invalid_CLI_Argument_Missing = "Invalid CLI argument '--{0}': Argument missing",
  ASP_203_Invalid_CLI_Argument_Invalid_Option_Type = "Invalid CLI argument '--{0}': Invalid option type '{1}'",
  ASP_204_Invalid_CLI_Argument_Cannot_Be_Passed = "Invalid CLI argument '--{0}': option has type '{1}' and cannot be passed via argv",
  ASP_300_Invalid_Configuration_Must_Be_An_Object = "Invalid Configuration at '{0}': Must be an object",
  ASP_301_Invalid_Configuration_Shape_Type_Expected = "Invalid Configuration at '{0}': Property '{1}' must be '{2}', received '{3}'",
  ASP_302_Invalid_Configuration_Property_Type_Expected = "Invalid Configuration Option at '{0}': Property '{1}' must be '{2}', received '{3}'",
  ASP_303_Invalid_Configuration_Unexpected_Option = "Invalid Configuration Option at '{0}': Property '{1}' is invalid",
  ASP_304_Invalid_Configuration_Option_Type = "Invalid Configuration Option at '{0}': Property '{1}' has an invalid type '{2}', expected '{3}'",
  ASP_305_Invalid_Configuration_At = "Invalid Configuration at '{0}': {1}"
}
