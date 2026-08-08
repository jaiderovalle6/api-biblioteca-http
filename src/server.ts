import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";

interface Book {
  id: number;
  title: string;
  author: string;
  publicationYear: number;
  available: boolean;
}

const PORT = Number(process.env.PORT ?? 3000);

const books: Book[] = [
  {
    id: 1,
    title: "Clean Code",
    author: "Robert C. Martin",
    publicationYear: 2008,
    available: true,
  },
  {
    id: 2,
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt y David Thomas",
    publicationYear: 1999,
    available: false,
  },
];

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });

  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

const server = createServer(async (request, response) => {
  try {
    const method = request.method ?? "GET";

    const requestUrl = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    const { pathname, searchParams } = requestUrl;

    if (method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        booksInMemory: books.length,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (method === "GET" && pathname === "/api/books") {
      let filtered = books;

      const author = searchParams.get("author");
      const available = searchParams.get("available");

      if (author) {
        filtered = filtered.filter((b) =>
          b.author.toLowerCase().includes(author.toLowerCase()),
        );
      }

      if (available) {
        if (available !== "true" && available !== "false") {
          sendJson(response, 400, {
            error: "VALIDATION_ERROR",
            message: "El filtro available solo acepta true o false",
          });
          return;
        }
        const isAvailable = available === "true";
        filtered = filtered.filter((b) => b.available === isAvailable);
      }

      sendJson(response, 200, {
        data: filtered,
        total: filtered.length,
      });
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/books/")) {
      const idStr = pathname.replace("/api/books/", "");
      const id = Number(idStr);

      if (!Number.isInteger(id) || id <= 0) {
        sendJson(response, 400, {
          error: "VALIDATION_ERROR",
          message: "El id debe ser un número entero positivo",
        });
        return;
      }

      const book = books.find((b) => b.id === id);
      if (!book) {
        sendJson(response, 404, {
          error: "BOOK_NOT_FOUND",
          message: "No existe un libro con el identificador solicitado",
        });
        return;
      }

      sendJson(response, 200, { data: book });
      return;
    }

    sendJson(response, 404, {
      error: "ROUTE_NOT_FOUND",
      message: "La ruta solicitada no existe",
      method,
      path: pathname,
    });
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, {
        error: "INVALID_JSON",
        message: "El body contiene un JSON inválido",
      });
      return;
    }

    console.error("Error inesperado:", error);

    sendJson(response, 500, {
      error: "INTERNAL_SERVER_ERROR",
      message: "Ocurrió un error interno",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
