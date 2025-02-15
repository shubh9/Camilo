import { serverUrl } from "../App";

export const updateBlogsFromBlogger = async () => {
  try {
    const response = await fetch(`${serverUrl}/blog/update`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      console.log("response: ", response);
      throw new Error("Failed to pull blogs");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error pulling blogs:", error);
    throw error;
  }
};
