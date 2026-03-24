import type { MetadataRoute } from "next";
import { withBasePath } from "../lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedTest",
    short_name: "MedTest",
    description: "Testovnice z mediciny pre iPhone a web.",
    start_url: withBasePath("/"),
    display: "standalone",
    background_color: "#f5faf8",
    theme_color: "#1d9b7c",
    lang: "sk",
    icons: [
      {
        src: withBasePath("/icon.svg"),
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: withBasePath("/apple-icon.svg"),
        sizes: "180x180",
        type: "image/svg+xml",
      },
    ],
  };
}
