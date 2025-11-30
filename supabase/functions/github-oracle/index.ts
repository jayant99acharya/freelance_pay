import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GitHubVerificationRequest {
  repo: string;
  owner: string;
  branch?: string;
  minCommits?: number;
  since?: string;
  githubToken: string;
  projectId?: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  html_url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { repo, owner, branch = "main", minCommits = 1, since, githubToken, projectId }: GitHubVerificationRequest = await req.json();

    if (!repo || !owner) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "Missing required parameters: repo and owner"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!githubToken) {
      return new Response(
        JSON.stringify({
          verified: false,
          error: "GitHub Personal Access Token is required"
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const headers: HeadersInit = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "QIE-Freelance-Oracle",
      "Authorization": `token ${githubToken}`,
    };

    let url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}`;
    if (since) {
      url += `&since=${since}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
      return new Response(
        JSON.stringify({
          verified: false,
          error: `GitHub API error: ${response.status}`,
          details: errorData,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const commits: GitHubCommit[] = await response.json();

    const verified = commits.length >= minCommits;

    const latestCommit = commits[0];
    const commitCount = commits.length;

    if (projectId && latestCommit && Deno.env.get('SUPABASE_URL') && Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const updateData: any = {
          commit_count: commitCount,
          latest_commit_sha: latestCommit.sha,
          latest_commit_url: latestCommit.html_url,
        };

        if (commitCount > 0) {
          updateData.status = 'active';
        }

        await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId);
      } catch (dbError) {
        console.error('Error updating project:', dbError);
      }
    }

    return new Response(
      JSON.stringify({
        verified,
        commitCount: commits.length,
        minCommits,
        latestCommit: latestCommit ? {
          sha: latestCommit.sha.substring(0, 7),
          fullSha: latestCommit.sha,
          url: latestCommit.html_url,
          message: latestCommit.commit.message.split('\n')[0],
          author: latestCommit.commit.author.name,
          date: latestCommit.commit.author.date,
        } : null,
        commits: commits.slice(0, 5).map(c => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
        })),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        verified: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
