export function privateInterviewAssetRequest(source, requestBase, pageOrigin, accessToken) {
  if (!source) throw new Error("The applicant answer PDF is not ready yet.");
  if (!accessToken) throw new Error("Please sign in with Google");

  const base = new URL(requestBase || "/", pageOrigin);
  let url;
  if (/^https?:\/\//i.test(source)) {
    const absolute = new URL(source);
    if (absolute.origin !== base.origin) {
      throw new Error("The answer PDF must be loaded through the authenticated HireIQ API.");
    }
    url = absolute.toString();
  } else if (source.startsWith("/api/")) {
    url = new URL(source, base.origin).toString();
  } else {
    const normalizedBase = requestBase.endsWith("/") ? requestBase : `${requestBase}/`;
    url = new URL(source.replace(/^\//, ""), new URL(normalizedBase, pageOrigin)).toString();
  }

  return {
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/pdf",
    },
  };
}
