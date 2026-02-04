import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  query, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Report } from '../types';
import { hidePlot } from './plots';

const REPORTS_COLLECTION = 'reports';

export const getAllReports = async (): Promise<Report[]> => {
  try {
    const q = query(collection(db, REPORTS_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Report;
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    throw error;
  }
};

export const resolveReport = async (reportId: string): Promise<void> => {
  try {
    const reportRef = doc(db, REPORTS_COLLECTION, reportId);
    await updateDoc(reportRef, {
      status: 'resolved',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error resolving report:', error);
    throw error;
  }
};

export const resolveReportAndHidePlot = async (reportId: string, plotId: string): Promise<void> => {
  try {
    await hidePlot(plotId);
    await resolveReport(reportId);
  } catch (error) {
    console.error('Error resolving report and hiding plot:', error);
    throw error;
  }
};
