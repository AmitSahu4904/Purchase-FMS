import React from 'react';
import { Document, Page, View, Image, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 6,
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  qrContainer: {
    width: 68,
    height: 68,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
    paddingLeft: 6,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 7.5,
    fontWeight: 'bold',
    marginBottom: 1,
    fontFamily: 'Helvetica-Bold',
  },
  itemCode: {
    fontSize: 6,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  serialNo: {
    fontSize: 8.5,
    fontWeight: 'bold',
    fontFamily: 'Courier-Bold',
  },
  expiryDate: {
    fontSize: 6,
    fontWeight: 'bold',
    marginTop: 2,
    fontFamily: 'Helvetica-Bold',
  },
});

interface SerialPDFDocumentProps {
  itemName: string;
  itemCode: string;
  encodedDate: string;
  serials: Array<{
    serialNo: string;
    qrDataUrl: string;
  }>;
}

export const SerialPDFDocument = ({ itemName, itemCode, encodedDate, serials }: SerialPDFDocumentProps) => {
  return (
    <Document>
      {serials.map((s, idx) => (
        <Page key={idx} size={[141.73, 107.72]} style={styles.page}>
          <View style={styles.qrContainer}>
            <Image src={s.qrDataUrl} style={styles.qrImage} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.itemName}>{itemName.toUpperCase()}</Text>
            <Text style={styles.itemCode}>({itemCode})</Text>
            <Text style={styles.serialNo}>{s.serialNo}</Text>
            {encodedDate ? <Text style={styles.expiryDate}>{encodedDate}</Text> : null}
          </View>
        </Page>
      ))}
    </Document>
  );
};
