// Stand-in text for sections the team will write. Search the codebase for
// <Placeholder to find every spot that still needs real copy.

const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.",
  "Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat. Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus.",
];

/** `paragraphs` blocks of lorem ipsum, marked so unfinished copy is easy to spot. */
export default function Placeholder({ paragraphs = 1, hint }) {
  return (
    <div className="placeholder">
      {hint && <p className="placeholder-hint">To write: {hint}</p>}
      {Array.from({ length: paragraphs }, (_, i) => <p key={i}>{LOREM[i % LOREM.length]}</p>)}
    </div>
  );
}
