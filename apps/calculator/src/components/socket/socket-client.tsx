"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { Empty, EmptyTitle } from "@/components/ui/empty";

interface Message {
  id: string;
  text: string;
  timestamp: string;
  type?: "message" | "ping";
}

interface Props {
  socketUrl: string;
}

export default function SocketClient({ socketUrl }: Props) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");

  useEffect(() => {
    const socketInstance = io(socketUrl, {
      withCredentials: true,
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("message", (data: Message) => {
      setMessages((prev) => {
        const newMessages: Message[] = [...prev, { ...data, type: "message" }];
        return newMessages.slice(-100);
      });
    });

    socketInstance.on("ping", (data: Message) => {
      setMessages((prev) => {
        const newMessages: Message[] = [...prev, { ...data, type: "ping" }];
        return newMessages.slice(-100);
      });
    });

    socketRef.current = socketInstance;

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [socketUrl]);

  const sendMessage = () => {
    if (socketRef.current && inputMessage.trim()) {
      socketRef.current.emit("client-message", {
        text: inputMessage,
        timestamp: new Date().toISOString(),
      });
      setInputMessage("");
    }
  };

  return (
    <div className="min-h-screen p-8 pb-20 font-sans sm:p-20">
      <main className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">Socket.IO + Next.js</h1>

        {/* Connection Status */}
        <div className="mb-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <div
              className={`size-4 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="font-medium">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* Message Input */}
        <div className="mb-6 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800"
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            type="text"
            value={inputMessage}
          />
          <button
            className="rounded-lg bg-blue-500 px-6 py-2 font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!(isConnected && inputMessage.trim())}
            onClick={sendMessage}
            type="button"
          >
            Send
          </button>
        </div>

        {/* Messages Display */}
        <div className="h-96 overflow-y-auto rounded-lg border border-gray-300 p-4 dark:border-gray-700">
          <h2 className="mb-4 text-xl font-semibold">Messages</h2>
          {messages.length === 0 ? (
            <Empty>
              <EmptyTitle>No messages yet...</EmptyTitle>
            </Empty>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <div
                  className="rounded-lg bg-gray-100 p-3 dark:bg-gray-800"
                  key={msg.id}
                >
                  <p className="text-sm">{msg.text}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total messages received:{" "}
            <span className="font-bold">{messages.length}</span>
          </p>
        </div>
      </main>
    </div>
  );
}
