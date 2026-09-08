	CBLOCK
	EETEMPINTCON
	ENDC

; EEDIR *******************************************************************************************
; Coloca el dato que esta en W en la dirección de la EEPROM

EEDIR
	BCF	STATUS,RP0		; Acceso al banco 2
	BSF	STATUS,RP1
	MOVWF	EEADR
	BCF	STATUS,RP0		; Acceso al banco 0
	BCF	STATUS,RP1
	RETURN

EELEER
	BSF	STATUS,RP0		; Acceso al banco 3
	BSF	STATUS,RP1
	BCF	EECON1,EEPGD		; Apuntar a la memoria de datos
	BSF	EECON1,RD		; Orden para empezar lectura
EELEER1
	BTFSC	EECON1,RD
	GOTO	EELEER1
	BCF	STATUS,RP0		; Acceso al banco 2
	BSF	STATUS,RP1
	MOVF	EEDATA,W
	BCF	STATUS,RP1		; Acceso al banco0
	RETURN
	
EEESCRIBIR
	BCF	STATUS,RP0		; Acceso al banco 2
	BSF	STATUS,RP1
	MOVWF	EEDATA
	BCF	STATUS,RP0		; Acceso al banco 0
	BCF	STATUS,RP1
	MOVF	INTCON,W
	MOVWF	EETEMPINTCON
	BSF	STATUS,RP0		; Acceso al banco 3
	BSF	STATUS,RP1
	BCF	INTCON,GIE		; Deshabilita las interrupciones
	BCF	EECON1,EEPGD		; Apuntar a la memoria de datos
	BSF	EECON1,WREN		; Habilita la escritura
	
	MOVLW	0x55
	MOVWF	EECON2
	MOVLW	0xAA
	MOVWF	EECON2
	BSF	EECON1,WR		; Inicia la escritura

EEESCRIBIR2
	BTFSC	EECON1,WR
	GOTO	EEESCRIBIR2
	BCF	EECON1,WREN
	BCF	EECON1,EEIF
	BCF	STATUS,RP0		; Acceso al banco 0
	BCF	STATUS,RP1
	MOVF	EETEMPINTCON,W
	MOVWF	INTCON
	RETURN

	


		
	