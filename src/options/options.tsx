import { createRoot } from 'react-dom/client'

function Options() {
  return (
    <main>
      <h1>Warden</h1>
    </main>
  )
}

const root = document.getElementById("root")
if (!root) {
  throw new Error("Missing root!")
}

createRoot(root).render(<Options />)
