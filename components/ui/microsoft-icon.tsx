import * as React from "react";

export function MicrosoftIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 23 23"
      width="23"
      height="23"
      {...props}
    >
      <rect x="0" y="0" width="11" height="11" fill="#f25022" />
      <rect x="12" y="0" width="11" height="11" fill="#7fba00" />
      <rect x="0" y="12" width="11" height="11" fill="#00a4ef" />
      <rect x="12" y="12" width="11" height="11" fill="#ffb900" />
    </svg>
  );
}
