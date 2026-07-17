import type { TechnologyCategory } from "@/lib/job-descriptions/parser-contract";

export const JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY_VERSION = "m3.2.0";

export type TechnologyDictionaryEntry = {
  canonicalName: string;
  category: TechnologyCategory;
  aliases: string[];
};

export const JOB_DESCRIPTION_TECHNOLOGY_DICTIONARY: TechnologyDictionaryEntry[] = [
  { canonicalName: "Python", category: "PROGRAMMING_LANGUAGE", aliases: ["python"] },
  { canonicalName: "JavaScript", category: "PROGRAMMING_LANGUAGE", aliases: ["javascript"] },
  { canonicalName: "TypeScript", category: "PROGRAMMING_LANGUAGE", aliases: ["typescript", "type script"] },
  { canonicalName: "Node.js", category: "FRAMEWORK", aliases: ["node", "node.js", "nodejs"] },
  { canonicalName: "Express", category: "FRAMEWORK", aliases: ["express", "express.js"] },
  { canonicalName: "NestJS", category: "FRAMEWORK", aliases: ["nestjs", "nest js"] },
  { canonicalName: "React", category: "FRAMEWORK", aliases: ["react"] },
  { canonicalName: "Next.js", category: "FRAMEWORK", aliases: ["next.js", "nextjs", "next js"] },
  { canonicalName: "FastAPI", category: "FRAMEWORK", aliases: ["fastapi", "fast api"] },
  { canonicalName: "Flask", category: "FRAMEWORK", aliases: ["flask"] },
  { canonicalName: "C#", category: "PROGRAMMING_LANGUAGE", aliases: ["c#", "c sharp"] },
  { canonicalName: ".NET", category: "FRAMEWORK", aliases: [".net", "dotnet"] },
  { canonicalName: "ASP.NET", category: "FRAMEWORK", aliases: ["asp.net", "asp net"] },
  { canonicalName: "ASP.NET Core", category: "FRAMEWORK", aliases: ["asp.net core", "asp net core"] },
  { canonicalName: "Java", category: "PROGRAMMING_LANGUAGE", aliases: ["java"] },
  { canonicalName: "Kotlin", category: "PROGRAMMING_LANGUAGE", aliases: ["kotlin"] },
  { canonicalName: "Spring Boot", category: "FRAMEWORK", aliases: ["spring boot"] },
  { canonicalName: "Go", category: "PROGRAMMING_LANGUAGE", aliases: ["Go", "golang", "Golang"] },
  { canonicalName: "PostgreSQL", category: "DATABASE", aliases: ["postgres", "postgresql"] },
  { canonicalName: "MySQL", category: "DATABASE", aliases: ["mysql"] },
  { canonicalName: "SQL Server", category: "DATABASE", aliases: ["sql server", "mssql"] },
  { canonicalName: "MongoDB", category: "DATABASE", aliases: ["mongodb", "mongo db"] },
  { canonicalName: "Redis", category: "DATABASE", aliases: ["redis"] },
  { canonicalName: "pgvector", category: "DATA", aliases: ["pgvector"] },
  { canonicalName: "Qdrant", category: "DATA", aliases: ["qdrant"] },
  { canonicalName: "ChromaDB", category: "DATA", aliases: ["chromadb", "chroma db"] },
  { canonicalName: "AWS", category: "CLOUD_PLATFORM", aliases: ["aws", "amazon web services"] },
  { canonicalName: "Lambda", category: "CLOUD_PLATFORM", aliases: ["lambda", "aws lambda"] },
  { canonicalName: "SQS", category: "CLOUD_PLATFORM", aliases: ["sqs", "amazon sqs"] },
  { canonicalName: "CloudWatch", category: "CLOUD_PLATFORM", aliases: ["cloudwatch", "cloud watch"] },
  { canonicalName: "Docker", category: "INFRASTRUCTURE", aliases: ["docker"] },
  { canonicalName: "Kubernetes", category: "INFRASTRUCTURE", aliases: ["kubernetes", "k8s"] },
  { canonicalName: "Jenkins", category: "DEVOPS", aliases: ["jenkins"] },
  { canonicalName: "CloudFormation", category: "DEVOPS", aliases: ["cloudformation", "cloud formation"] },
  { canonicalName: "Terraform", category: "DEVOPS", aliases: ["terraform"] },
  { canonicalName: "REST", category: "ARCHITECTURE", aliases: ["rest", "restful"] },
  { canonicalName: "GraphQL", category: "ARCHITECTURE", aliases: ["graphql", "graph ql"] },
  { canonicalName: "Kafka", category: "INFRASTRUCTURE", aliases: ["kafka", "apache kafka"] },
  { canonicalName: "RabbitMQ", category: "INFRASTRUCTURE", aliases: ["rabbitmq", "rabbit mq"] },
  { canonicalName: "LangChain", category: "AI_ML", aliases: ["langchain", "lang chain"] },
  { canonicalName: "LLM", category: "AI_ML", aliases: ["llm", "large language model", "large language models"] },
  { canonicalName: "RAG", category: "AI_ML", aliases: ["rag", "retrieval augmented generation"] },
  { canonicalName: "OpenAI", category: "AI_ML", aliases: ["openai", "open ai"] },
  { canonicalName: "Ollama", category: "AI_ML", aliases: ["ollama"] },
  { canonicalName: "Prisma", category: "TOOL", aliases: ["prisma"] },
  { canonicalName: "TypeORM", category: "TOOL", aliases: ["typeorm", "type orm"] },
  { canonicalName: "Entity Framework", category: "TOOL", aliases: ["entity framework", "ef core", "entity framework core"] },
  { canonicalName: "CI/CD", category: "DEVOPS", aliases: ["ci/cd", "cicd", "continuous integration", "continuous delivery"] }
];
