"use server";

// Microsoft Graph API configuration
export const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0";

// Initialize Azure AD client configuration
export async function initializeGraphClient() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("Missing Azure AD configuration");
  }

  // This would typically use @azure/identity in production
  // For now, we'll create a helper for token management
  return {
    clientId,
    tenantId,
    getAccessToken: async () => {
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }).toString(),
      });

      if (!response.ok) {
        throw new Error("Failed to get access token from Azure AD");
      }

      const data = await response.json();
      return data.access_token;
    },
  };
}

// Sync student status from Microsoft Graph
export async function syncStudentStatusFromMSGraph(userEmail: string) {
  try {
    const client = await initializeGraphClient();
    const token = await client.getAccessToken();

    // Get user from Graph API
    const response = await fetch(
      `${GRAPH_API_BASE}/users/${userEmail}?$select=id,displayName,mail,accountEnabled,createdDateTime`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`User not found in Azure AD: ${userEmail}`);
      return null;
    }

    const user = await response.json();
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.mail,
      isActive: user.accountEnabled,
      createdAt: user.createdDateTime,
    };
  } catch (error) {
    console.error("Error syncing from Microsoft Graph:", error);
    throw error;
  }
}

// Check if student has graduated (based on academic year or group membership)
export async function checkStudentGraduationStatus(userEmail: string) {
  try {
    const client = await initializeGraphClient();
    const token = await client.getAccessToken();

    // Check if user is member of "Alumni" or "Graduated" group
    const groupResponse = await fetch(
      `${GRAPH_API_BASE}/users/${userEmail}/memberOf?$filter=displayName eq 'Graduated' or displayName eq 'Alumni'`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!groupResponse.ok) {
      return false;
    }

    const groups = await groupResponse.json();
    return groups.value && groups.value.length > 0;
  } catch (error) {
    console.error("Error checking graduation status:", error);
    return false;
  }
}
