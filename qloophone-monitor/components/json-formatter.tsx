import React from "react";

interface JsonFormatterProps {
  json: string;
}

const JsonFormatter: React.FC<JsonFormatterProps> = ({ json }) => {
  try {
    // Handle case where json might be a stringified JSON string (double encoded)
    let parsed = JSON.parse(json);
    
    // If the result is still a string, try parsing again (double encoded)
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        // If second parse fails, use the first parsed result
      }
    }
    
    return <JsonView data={parsed} />;
  } catch (e) {
    // If parsing fails, return the raw string
    return <span className="text-white/70 font-mono text-xs">{json}</span>;
  }
};

interface JsonViewProps {
  data: any;
  indent?: number;
}

const JsonView: React.FC<JsonViewProps> = ({ data, indent = 0 }) => {
  const indentStyle = { marginLeft: `${indent * 16}px` };

  if (data === null) {
    return <span className="text-orange-300">null</span>;
  }

  if (typeof data === "string") {
    return <span className="text-green-300">"{data}"</span>;
  }

  if (typeof data === "number") {
    return <span className="text-blue-300">{data}</span>;
  }

  if (typeof data === "boolean") {
    return <span className="text-purple-300">{data.toString()}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-white/50">[]</span>;
    }

    // For arrays of strings or numbers, display inline
    if (data.length > 0 && (typeof data[0] === "string" || typeof data[0] === "number")) {
      return (
        <span>
          <span className="text-white/50">[</span>
          {data.map((item, index) => (
            <span key={index}>
              <JsonView data={item} indent={0} />
              {index < data.length - 1 && <span className="text-white/50">, </span>}
            </span>
          ))}
          <span className="text-white/50">]</span>
        </span>
      );
    }

    // For arrays of objects, display each on new line
    return (
      <div style={indentStyle}>
        <span className="text-white/50">[</span>
        {data.map((item, index) => (
          <div key={index} style={{ marginLeft: "16px" }}>
            <JsonView data={item} indent={0} />
            {index < data.length - 1 && <span className="text-white/50">,</span>}
          </div>
        ))}
        <span className="text-white/50">]</span>
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <span className="text-white/50">{"{}"}</span>;
    }

    return (
      <div style={indentStyle}>
        <span className="text-white/50">{"{"}</span>
        {entries.map(([key, value], index) => (
          <div key={key} style={{ marginLeft: "16px" }} className="my-0.5">
            <span className="text-cyan-300">"{key}"</span>
            <span className="text-white/50">: </span>
            <JsonView data={value} indent={0} />
            {index < entries.length - 1 && <span className="text-white/50">,</span>}
          </div>
        ))}
        <span className="text-white/50">{"}"}</span>
      </div>
    );
  }

  return <span className="text-white/70">{String(data)}</span>;
};

export default JsonFormatter;