const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const isUserSite = repoName.endsWith(".github.io");

export const githubPagesBasePath =
  isGithubActions && repoName && !isUserSite ? `/${repoName}` : "";

export const withBasePath = (path: string) => {
  if (!githubPagesBasePath) {
    return path;
  }

  if (path === "/") {
    return `${githubPagesBasePath}/`;
  }

  return `${githubPagesBasePath}${path}`;
};
