import { useRef } from 'react'
import { KeyboardReact as Keyboard } from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'

export default function VirtualKeyboard({ value, onChange, onSubmit }) {
  const keyboardRef = useRef(null)

  function onKeyPress(button) {
    if (button === '{enter}') {
      onSubmit?.()
      return
    }
    if (button === '{shift}' || button === '{lock}') {
      const current = keyboardRef.current?.options?.layoutName
      keyboardRef.current?.setOptions({
        layoutName: current === 'shift' ? 'default' : 'shift',
      })
    }
    if (button === '{numbers}') {
      keyboardRef.current?.setOptions({ layoutName: 'numbers' })
    }
    if (button === '{abc}') {
      keyboardRef.current?.setOptions({ layoutName: 'default' })
    }
  }

  return (
    <div className="shrink-0">
      <Keyboard
        keyboardRef={(r) => (keyboardRef.current = r)}
        onChange={onChange}
        onKeyPress={onKeyPress}
        input={value}
        layout={{
          default: [
            'a z e r t y u i o p',
            'q s d f g h j k l m',
            '{shift} w x c v b n {bksp}',
            '{numbers} {space} {enter}',
          ],
          shift: [
            'A Z E R T Y U I O P',
            'Q S D F G H J K L M',
            '{shift} W X C V B N {bksp}',
            '{numbers} {space} {enter}',
          ],
          numbers: [
            '1 2 3 4 5 6 7 8 9 0',
            '- / : ; ( ) & @ "',
            '{abc} . , ? ! \' {bksp}',
            '{space} {enter}',
          ],
        }}
        display={{
          '{bksp}': '⌫',
          '{enter}': 'OK',
          '{shift}': '⇧',
          '{space}': ' ',
          '{numbers}': '123',
          '{abc}': 'ABC',
        }}
        theme="hg-theme-default hg-theme-dark"
        layoutName="default"
      />
    </div>
  )
}
