import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destination, interests, startDate, endDate } = await req.json();
    console.log("Generating itinerary for:", { destination, interests, startDate, endDate });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Create the prompt for AI
    const prompt = `Create a detailed ${days}-day travel itinerary for ${destination}.

Traveler interests: ${interests.join(", ")}
Trip dates: ${startDate} to ${endDate}

Please provide a comprehensive day-by-day itinerary in JSON format with the following structure:
{
  "destination": "${destination}",
  "summary": "Brief overview of the trip",
  "days": [
    {
      "day": 1,
      "date": "${startDate}",
      "theme": "Day theme",
      "description": "Overview of the day",
      "activities": [
        {
          "time": "09:00 AM",
          "name": "Activity name",
          "description": "Detailed description",
          "duration": "2 hours",
          "category": "sightseeing/food/adventure/culture/shopping",
          "tips": "Helpful tips"
        }
      ]
    }
  ],
  "tips": ["General trip tips"],
  "recommendations": {
    "restaurants": ["Restaurant recommendations"],
    "accommodation": ["Hotel/stay recommendations"],
    "transportation": ["Getting around tips"]
  }
}

Focus on activities that match the traveler's interests: ${interests.join(", ")}. Include specific places, timings, and practical tips. Make it realistic and actionable.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an expert travel planner. Always respond with valid JSON only, no additional text.",
            },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limits exceeded, please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Payment required, please add funds to your Lovable AI workspace.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");
    
    let itineraryText = data.choices?.[0]?.message?.content;
    if (!itineraryText) {
      throw new Error("No content in AI response");
    }

    // Extract JSON from markdown code blocks if present
    const jsonMatch = itineraryText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      itineraryText = jsonMatch[1];
    }

    const itinerary = JSON.parse(itineraryText.trim());

    // Get the current user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error("User not authenticated");
    }

    // Save to database
    const { data: trip, error: dbError } = await supabase
      .from("trips")
      .insert({
        user_id: user.id,
        destination,
        interests,
        start_date: startDate,
        end_date: endDate,
        itinerary,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw dbError;
    }

    console.log("Trip saved successfully");

    return new Response(JSON.stringify({ trip }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-itinerary function:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Failed to generate itinerary",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});