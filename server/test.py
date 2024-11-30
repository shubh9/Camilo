import AzureOpenAI

azure_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_KEY"),
    api_version="2024-02-15-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

def get_response(prompt):
    response = azure_client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a helpful assistant…"},
            {"role": "user", "content": prompt}
        ],
    )
    return response.choices[0].message.content

print(get_response("What is the capital of France?"))

if __name__ == "__main__":
    print(get_response("What is the capital of France?"))
