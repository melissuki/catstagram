import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export function AppToaster() {
  return (
    <ToastContainer
      position="top-center"
      autoClose={4500}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      pauseOnHover
      draggable
      theme="colored"
      toastClassName="!rounded-2xl !font-sans !text-sm !shadow-lg"
    />
  )
}
