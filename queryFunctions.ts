/**
 * Interface for query options
 */
interface QueryOptions {
  /** Project ID (default: "magnetic-runway-428121") */
  prj?: string;
  /** Dataset ID (default: "schools") */
  ds?: string;
  /** Table name */
  tbl?: string;
  /** Fields to select (default: "*") */
  select?: string;
  /** Query conditions that will be concatenated */
  conditions?: string[];
}

/**
 * Query response type
 */
type QueryResponse = Record<string, any>[];

/**
 * Query function for Google Cloud Run API 
 * @param options - Query configuration options
 * @returns Promise containing query results
 */
export async function anyQuery({
  prj = "magnetic-runway-428121",
  ds = "schools",
  tbl = "",
  select = "*",
  conditions = []
}: QueryOptions = {}): Promise<QueryResponse> {
  try {
    // Base API configuration
    const baseUrl = "https://backend-v1-1010920399604.northamerica-northeast2.run.app";
    
    let idToken: string;
    try {
      console.log("Attempting to get identity token...");
      
      const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=" + baseUrl, {
        headers: {
          "Metadata-Flavor": "Google"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get identity token: ${response.status} ${response.statusText}`);
      }
      
      idToken = await response.text();
      console.log("Token received successfully");
    } catch (error: any) {
      console.error("MS Connection failed. Full error:", error);
      console.error("Error message:", error.message);
      if (error.cause) console.error("Parent error:", error.cause);
      throw error;
    }

    // Prepare the query
    const query = `SELECT ${select} FROM ${tbl} ${conditions.join(" ")};`;
    
    // Prepare the request body
    const body = {
      fun: "get",
      projectId: prj,
      datasetId: ds,
      query: query
    };
    
    // Make the API request
    const apiResponse = await fetch(`${baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(body)
    });
    
    // Parse the response
    if (apiResponse.ok) {
      const result = await apiResponse.json();
      return result as QueryResponse;
    } else {
      const errorText = await apiResponse.text();
      console.error(`API request failed: ${errorText}`);
      throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
    }
  } catch (error: any) {
    console.error("Connection failed:", error.message);
    throw error;
  }
}

module.exports = { anyQuery }; 