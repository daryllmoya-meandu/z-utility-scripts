// ------------------------------------------------------------
// Config
// ------------------------------------------------------------
import "dotenv/config";

const API_TOKEN = process.env.BUILDKITE_API_TOKEN;

if (!API_TOKEN) {
  throw new Error("Missing BUILDKITE_API_TOKEN in .env file");
}

const API_URL = "https://api.buildkite.com/v2/organizations/mryum/pipelines";
const PAGE_PARAMS = "page=1&per_page=20";

// ------------------------------------------------------------
// Type Definitions
// ------------------------------------------------------------

interface Author {
  name: string;
}

interface Build {
  message: string;
  state: string;
  blocked: boolean;
  author?: Author;
  number: number;
  web_url: string;
}

type Pipeline = string;
type Branch = string;
type PipelineTuple = [Pipeline, Branch];

interface PipelineBuilds {
  pipeline: string;
  builds: Build[];
  number: number;
  url: string;
}

// ------------------------------------------------------------
// Functions
// ------------------------------------------------------------

/** Fetch builds for a given pipeline and branch */
const fetchBuilds = async (
  pipeline: string,
  branch: string
): Promise<Build[]> => {
  try {
    const response = await fetch(
      `${API_URL}/${pipeline}/builds?branch=${branch}&${PAGE_PARAMS}`,
      { headers: { Authorization: `Bearer ${API_TOKEN}` } }
    );

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error(`Error fetching builds for ${pipeline}:`, error);
    return [];
  }
};

/** Determines if a build needs a release */
const needsRelease = (build: Build): boolean =>
  ["failed", "running"].includes(build.state) || build.blocked;

/** Filters builds that need a release */
const getReleaseBuilds = (builds: Build[]): Build[] =>
  builds.filter(needsRelease);

/** Extracts the first line of a given text */
const getFirstLine = (text: string): string => text.split("\n")[0] || text;

/** Maps a build to a formatted release note */
const buildToReleaseNoteMapper = (build: Build): string =>
  `${getFirstLine(build.message.replace(/\@/g, "@ "))} *by ${
    build.author?.name || "(unknown)"
  }*`;

/** Fetch builds for multiple pipelines */
const getPipelinesBuilds = async (
  pipelineTuples: PipelineTuple[]
): Promise<PipelineBuilds[]> =>
  Promise.all(
    pipelineTuples.map(async ([pipeline, branch]) => {
      const builds = await fetchBuilds(pipeline, branch);
      const releaseBuild = builds[0];

      return releaseBuild
        ? {
            pipeline,
            builds,
            number: releaseBuild.number,
            url: releaseBuild.web_url,
          }
        : { pipeline, builds: [], number: 0, url: "" };
    })
  );

/** Returns the markdown link for a build */
const getBuildItemLink = (build: PipelineBuilds): string =>
  `[${build.number}](${build.url})`;

/** Converts pipeline builds to a markdown list */
const convertToMarkdownList = (pipelinesBuilds: PipelineBuilds[]): string =>
  pipelinesBuilds
    .map((pipelineBuilds) => {
      const releaseBuilds = getReleaseBuilds(pipelineBuilds.builds);
      const releaseNotes = releaseBuilds.map(buildToReleaseNoteMapper);

      if (releaseNotes.length === 0) return "";

      const markdownHeader = `- \`${
        pipelineBuilds.pipeline
      }\` build ${getBuildItemLink(pipelineBuilds)}`;

      return releaseNotes.length === 1
        ? `${markdownHeader}, ${releaseNotes[0]}\n`
        : `${markdownHeader}:\n${releaseNotes
            .map((note) => `    - ${note}`)
            .join("\n")}`;
    })
    .join("\n");

/** Returns today's release date */
const getReleaseDate = (): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

/** Rounds minutes to the nearest base */
const roundMinutesToNearestBase = (minutes: number, base: number): number =>
  Math.round(minutes / base) * base;

/** Formats a Date object to HH:MM */
const getReadableTime = (date: Date): string =>
  `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;

/** Gets the next closest rounded time in AEST/AEDT */
const getNextClosest = (
  minutesInFuture: number,
  minutesToRoundTo: number
): string => {
  const releaseTimeLocal = new Date();
  releaseTimeLocal.setMinutes(releaseTimeLocal.getMinutes() + minutesInFuture);
  releaseTimeLocal.setMinutes(
    roundMinutesToNearestBase(releaseTimeLocal.getMinutes(), minutesToRoundTo)
  );

  const releaseTimeMelbourne = new Date(releaseTimeLocal.getTime());
  releaseTimeMelbourne.setHours(releaseTimeMelbourne.getHours() + 1);

  return `${getReadableTime(releaseTimeLocal)} AEST/AEDT`;
};

/** Logs the release notes for multiple pipelines */
const logReleaseNotes = async (pipelines: PipelineTuple[]): Promise<void> => {
  const pipelinesBuilds = await getPipelinesBuilds(pipelines);

  console.log(`### Serve releases for ${getReleaseDate()}\n`);
  console.log(convertToMarkdownList(pipelinesBuilds));
  console.log(
    `Will :big-red-button: in approx. 30mins at ${getNextClosest(
      30,
      15
    )} if no objections.`
  );
};

// ------------------------------------------------------------
// Main Program
// ------------------------------------------------------------

logReleaseNotes([
  // ["beamer", "main"],
  // ["cloudflare-workers", "main"],
  // ["guest-gateway", "main"],
  // ["manage-api", "main"],
  // ["manage-frontend", "main"],
  // ["mr-yum", "master"],
  // ["mr-yum-deploy", "staging"],
  // ["serve-api", "main"],
  // ["serve-frontend", "main"],
  ["crew-bff", "main"],
]);
