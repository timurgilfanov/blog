import type { ThemeRegistration } from "shiki";

export const forestLight: ThemeRegistration = {
  name: "forest-light",
  type: "light",
  colors: {
    "editor.background": "#ecede5",
    "editor.foreground": "#0e1612",
  },
  tokenColors: [
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator",
        "storage.type",
        "storage.modifier",
      ],
      settings: { foreground: "#006846" },
    },
    {
      scope: ["string", "string.quoted", "string.template", "string.regexp"],
      settings: { foreground: "#7a6428" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#566359", fontStyle: "italic" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#8a5018" },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function"],
      settings: { foreground: "#0e1612" },
    },
    {
      scope: ["punctuation", "meta.brace", "meta.delimiter"],
      settings: { foreground: "#7a8a80" },
    },
  ],
};

export const forestDark: ThemeRegistration = {
  name: "forest-dark",
  type: "dark",
  colors: {
    "editor.background": "#040a07",
    "editor.foreground": "#dce5dd",
  },
  tokenColors: [
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator",
        "storage.type",
        "storage.modifier",
      ],
      settings: { foreground: "#61c49d" },
    },
    {
      scope: ["string", "string.quoted", "string.template", "string.regexp"],
      settings: { foreground: "#c8b878" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#5b6b62", fontStyle: "italic" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#e0a878" },
    },
    {
      scope: ["entity.name.function", "support.function", "variable.function"],
      settings: { foreground: "#dce5dd" },
    },
    {
      scope: ["punctuation", "meta.brace", "meta.delimiter"],
      settings: { foreground: "#5a6a60" },
    },
  ],
};
