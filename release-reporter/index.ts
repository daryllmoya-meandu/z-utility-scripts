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
// Interfaces
// ------------------------------------------------------------
interface Author {
  name: string;
}

interface Build {
  message: string;
  state: string;
  blocked: boolean;
  author: Author;
  number?: number;
  web_url?: string;
}

type Pipeline = string;
type Branch = string;
type PipelineTuple = [Pipeline, Branch];

interface PipelineBuilds {
  pipeline: string;
  builds: Build[];
  number: number;
  url: string | null;
}

// ------------------------------------------------------------
// Functions
// ------------------------------------------------------------

/** Fetch builds for a given pipeline and branch */
const fetchBuilds = async (
  pipeline: string,
  branch: string
): Promise<Build[]> => {
  const response = await fetch(
    `${API_URL}/${pipeline}/builds?branch=${branch}&${PAGE_PARAMS}`,
    { headers: { Authorization: `Bearer ${API_TOKEN}` } }
  );

  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

  return await response.json();
};

/** Determines if a build needs a release */
const needsRelease = (build: Build): boolean =>
  ["failed", "running"].includes(build.state) || build.blocked;

const getReleaseBuilds = (builds: Build[]): Build[] => {
  const blockedBuilds: Build[] = [];

  for (const build of builds) {
    if (needsRelease(build)) {
      blockedBuilds.push(build);
    } else {
      break;
    }
  }

  return blockedBuilds;
};

const buildToReleaseNoteMapper = (build: Build): string => {
  const message = build.message.replace(/\@/g, "@ ");
  return `${getFirstLine(message)} *by ${build?.author?.name || "(unknown)"}*`;
};

const getFirstLine = (text: string): string => {
  const index: number = text.indexOf("\n");
  return index === -1 ? text : text.substring(0, index);
};

const getPipelinesBuilds = async (
  pipelineTuples: PipelineTuple[]
): Promise<PipelineBuilds[]> => {
  return Promise.all(
    pipelineTuples.map(async ([pipeline, branch]) => {
      const builds = await fetchBuilds(pipeline, branch);
      const releaseBuild = builds.length > 0 ? builds[0] : null;

      return {
        pipeline,
        builds,
        number: releaseBuild ? releaseBuild.number ?? 0 : 0,
        url: releaseBuild ? releaseBuild.web_url ?? null : null,
      };
    })
  );
};

const getBuildItemLink = (build: PipelineBuilds): string =>
  `[${build.number}](${build.url})`;

const convertToMarkdownList = (pipelinesBuilds: PipelineBuilds[]): string => {
  let markdown = "";

  pipelinesBuilds.forEach((pipelineBuilds) => {
    const releaseBuilds = getReleaseBuilds(pipelineBuilds.builds);
    const releaseNotes = releaseBuilds.map(buildToReleaseNoteMapper);

    if (releaseNotes.length === 0) return;

    markdown += `- \`${pipelineBuilds.pipeline}\` build ${getBuildItemLink(
      pipelineBuilds
    )}`;

    if (releaseNotes.length === 1) {
      markdown += `, ${releaseNotes[0]}\n`;
      return;
    }

    markdown += ":\n";
    releaseNotes.forEach((note) => {
      markdown += `    - ${note}\n`;
    });
  });

  return markdown;
};

const getReleaseDate = (): string => {
  const today = new Date();
  return today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const roundMinutesToNearestBase = (minutes: number, base: number): number =>
  Math.round(minutes / base) * base;

const getReadableTime = (date: Date): string =>
  date.getMinutes() < 10
    ? `${date.getHours()}:0${date.getMinutes()}`
    : `${date.getHours()}:${date.getMinutes()}`;

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

const logReleaseNotes = async (pipelines: PipelineTuple[]): Promise<void> => {
  const pipelinesBuilds = await getPipelinesBuilds(pipelines);
  console.log(`### Releases for ${getReleaseDate()}`);
  console.log("");
  console.log(convertToMarkdownList(pipelinesBuilds));
  // console.log(
  //   `Will :big-red-button: in approx. 30mins at ${getNextClosest(
  //     30,
  //     15
  //   )} if no objections.`
  // );
};

// ------------------------------------------------------------
// Main program
// ------------------------------------------------------------
logReleaseNotes([
  ["beamer", "main"],
  ["cloudflare-workers", "main"],
  ["guest-gateway", "main"],
  ["serve-api", "main"],
  ["serve-frontend", "main"],
  ["manage-api", "main"],
  ["manage-frontend", "main"],
  ["mr-yum", "master"],
  ["mr-yum-deploy", "staging"],
  ["crew-bff", "main"],
]);
