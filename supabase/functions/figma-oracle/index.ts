import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FigmaVerificationRequest {
  fileKey: string;
  figmaToken: string;
  minVersions?: number;
  since?: string;
}

interface FigmaVersion {
  id: string;
  created_at: string;
  label: string;
  description: string;
  user: {
    handle: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { fileKey, figmaToken, minVersions = 1, since }: FigmaVerificationRequest = await req.json();

    if (!fileKey || !figmaToken) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: fileKey and figmaToken" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const versionsUrl = `https://api.figma.com/v1/files/${fileKey}/versions`;
    const versionsResponse = await fetch(versionsUrl, {
      headers: {
        "X-Figma-Token": figmaToken,
      },
    });

    if (!versionsResponse.ok) {
      const errorData = await versionsResponse.json().catch(() => ({ message: "Unknown error" }));
      return new Response(
        JSON.stringify({
          verified: false,
          error: `Figma API error: ${versionsResponse.status}`,
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

    const data = await versionsResponse.json();
    let versions: FigmaVersion[] = data.versions || [];

    if (since) {
      const sinceDate = new Date(since);
      versions = versions.filter(v => new Date(v.created_at) >= sinceDate);
    }

    const verified = versions.length >= minVersions;

    return new Response(
      JSON.stringify({
        verified,
        versionCount: versions.length,
        minVersions,
        versions: versions.slice(0, 5).map(v => ({
          id: v.id,
          label: v.label || "Untitled",
          description: v.description || "",
          author: v.user?.handle || "Unknown",
          date: v.created_at,
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