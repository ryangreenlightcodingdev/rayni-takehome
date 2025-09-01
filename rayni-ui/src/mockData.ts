// Type definitions
export interface Project {
  id: string;
  name: string;
}

export interface Instrument {
  id: string;
  name: string;
  projectId: string;
}

export interface Doc {
  id: string;
  name: string;
  source: string;
  url: string;
  status: string;
  projectId: string;
}

// Mock data
export const projects: Project[] = [
  {
    id: "p1",
    name: "Orbitrap Exploris MX Project"
  },
  {
    id: "p2", 
    name: "Labs Research Project"
  }
];

export const instruments: Instrument[] = [
  {
    id: "i1",
    name: "Orbitrap Exploris MX",
    projectId: "p1"
  },
  {
    id: "i2",
    name: "Lab Equipment A",
    projectId: "p2"
  }
];

export const docs: Doc[] = [
  {
    id: "d1",
    name: "Orbitrap Exploris MX Software Manual.pdf",
    source: "local",
    url: "/docs/orbitrap-exploris-mx.pdf",
    status: "indexed",
    projectId: "p1"
  },
  {
    id: "d2",
    name: "Primer on Labs and User Journey",
    source: "local",
    url: "/docs/labs-primer.pdf",
    status: "indexed",
    projectId: "p2"
  }
];
  

// Chat types
export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: number;
    citations?: { label: string; docId: string; page: number }[];
  }
  
  export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
  }
  
  // Mock saved chat
  export const savedChats: ChatSession[] = [
    {
      id: "c1",
      title: "HPLC: Low signal troubleshooting",
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Why is HPLC signal low after maintenance?",
          createdAt: Date.now(),
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Try: 1) Verify pump seals and leaks. 2) Check mobile phase composition and degas. 3) Re-calibrate detector.",
          createdAt: Date.now(),
          citations: [{ label: "[1]", docId: "d1", page: 42 }],
        },
      ],
    },
  ];
  