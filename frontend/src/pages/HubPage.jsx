import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  getAdminDashboard,
  updateAdminCourseStatus,
  updateAdminMentorVisibility,
} from '../api/admin';
import { getMe, logout } from '../api/auth';
import {
  createSessionFeedback,
  getMySessionFeedbacks,
  getSessionFeedbackByReservationId,
  getSessionFeedbackByRequestId,
} from '../api/feedbacks';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../api/notifications';
import {
  approveMentorApplication,
  getMyMentorApplication,
  getPendingMentorApplications,
  rejectMentorApplication,
  submitMentorApplication,
} from '../api/mentorApplications';
import {
  approveMentorCourseApplication,
  cancelMentorCourseApplication,
  createMentorCourseApplication,
  getMyMentorCourseApplications,
  getReceivedMentorCourseApplications,
  rejectMentorCourseApplication,
} from '../api/mentorCourseApplications';
import {
  createMyMentorCourse,
  getMyMentorProfile,
  updateMyMentorAvailability,
  updateMyMentorCourse,
  updateMyMentorProfile,
} from '../api/mentorManagement';
import {
  acceptMentoringRequest,
  createMentoringRequest,
  getReceivedMentoringRequests,
  getSentMentoringRequests,
  rejectMentoringRequest,
} from '../api/mentoring';
import {
  acceptReservation,
  cancelReservation,
  createReservation,
  getMyReservations,
  getReceivedReservations,
  rejectReservation,
} from '../api/reservations';
import { getSpaces } from '../api/spaces';
import { getMentors } from '../api/users';
import AppLayout from '../components/AppLayout';
import {
  dismissLobbyNotification,
  getDismissedLobbyNotificationIds,
} from '../lib/lobbyNotificationStorage';
import { getPrimarySpacePathFromSpaces } from '../lib/primarySpaceNavigation';
import { getReservationEntryState } from '../lib/reservationEntryState';
import { useAuthStore } from '../store/authStore';

const DAY_OF_WEEK_LABELS = {
  MONDAY: '월요일',
  TUESDAY: '화요일',
  WEDNESDAY: '수요일',
  THURSDAY: '목요일',
  FRIDAY: '금요일',
  SATURDAY: '토요일',
  SUNDAY: '일요일',
};

const DEFAULT_MENTOR_COURSE_FORM = {
  title: '',
  summary: '',
  description: '',
  meetingType: 'ONLINE',
  price: '0',
  capacity: '1',
  curriculumItems: [
    {
      id: 'curriculum-draft-initial',
      title: '',
      description: '',
    },
  ],
  status: 'DRAFT',
};

const DEFAULT_MENTOR_FILTERS = {
  keyword: '',
  dayOfWeek: 'ALL',
  meetingType: 'ALL',
  maxPrice: 'ALL',
  sort: 'recommended',
};

function createAvailabilityDraft() {
  return {
    id: `availability-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    dayOfWeek: 'MONDAY',
    startTime: '19:00',
    endTime: '20:00',
  };
}

function createCurriculumDraft() {
  return {
    id: `curriculum-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: '',
    description: '',
  };
}

function normalizeTimeValue(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 5);
}

function normalizeAvailabilitySlots(rawValue) {
  const slotItems = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(rawValue?.items)
      ? rawValue.items
      : Array.isArray(rawValue?.slots)
        ? rawValue.slots
        : [];

  return slotItems
    .map((slot, index) => ({
      id: slot.id ?? `mentor-slot-${index}`,
      dayOfWeek: slot.dayOfWeek || 'MONDAY',
      startTime: normalizeTimeValue(slot.startTime),
      endTime: normalizeTimeValue(slot.endTime),
    }))
    .sort((leftSlot, rightSlot) => {
      const leftOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].indexOf(leftSlot.dayOfWeek);
      const rightOrder = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].indexOf(rightSlot.dayOfWeek);

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return leftSlot.startTime.localeCompare(rightSlot.startTime);
    });
}

function normalizeMentorCourses(rawValue) {
  const courseItems = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(rawValue?.items)
      ? rawValue.items
      : Array.isArray(rawValue?.courses)
        ? rawValue.courses
        : [];

  return courseItems.map((course, index) => ({
    id: course.id ?? `mentor-course-${index}`,
    title: course.title || `수업 ${index + 1}`,
    summary: course.summary || '',
    description: course.description || '',
    meetingType: course.meetingType || 'ONLINE',
    price: Number(course.price ?? 0) || 0,
    capacity: Number(course.capacity ?? 0) || 0,
    approvedApplicationCount: Number(course.approvedApplicationCount ?? 0) || 0,
    remainingCapacity:
      Number(course.remainingCapacity ?? course.capacity ?? 0) || 0,
    curriculumItems: Array.isArray(course.curriculumItems)
      ? course.curriculumItems.map((item, itemIndex) => ({
          id: item.id ?? `course-curriculum-${index}-${itemIndex}`,
          sequence: item.sequence ?? itemIndex + 1,
          title: item.title || '',
          description: item.description || '',
        }))
      : [],
    status: course.status || 'DRAFT',
    createdAt: course.createdAt || null,
    updatedAt: course.updatedAt || null,
  }));
}

function normalizeMentorManagementProfile(rawValue) {
  if (!rawValue) {
    return null;
  }

  const profile = rawValue.item || rawValue.profile || rawValue;

  return {
    userId: profile.userId ?? profile.id ?? null,
    email: profile.email || '',
    nickname: profile.nickname || '',
    role: profile.role || 'MENTOR',
    bio: profile.bio || '',
    interests: profile.interests || '',
    specialties: profile.specialties || '',
    avatarUrl: profile.avatarUrl || '',
    mentorEnabled: Boolean(profile.mentorEnabled ?? true),
    availabilitySlots: normalizeAvailabilitySlots(profile.availabilitySlots),
    courses: normalizeMentorCourses(profile.courses),
  };
}

function getMentorCourseApplicationItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.applications)) {
    return rawValue.applications;
  }

  return [];
}

function normalizeMentorCourseApplications(rawValue) {
  return getMentorCourseApplicationItems(rawValue).map((application, index) => ({
    id: application.id ?? `mentor-course-application-${index}`,
    courseId: application.courseId ?? null,
    courseTitle: application.courseTitle || `수업 ${index + 1}`,
    courseSummary: application.courseSummary || '',
    courseMeetingType: application.courseMeetingType || 'ONLINE',
    coursePrice: Number(application.coursePrice ?? 0) || 0,
    mentorId: application.mentorId ?? null,
    mentorNickname: application.mentorNickname || '멘토',
    applicantId: application.applicantId ?? null,
    applicantNickname: application.applicantNickname || '신청자',
    message: application.message || '',
    status: application.status || 'PENDING',
    reviewNote: application.reviewNote || '',
    createdAt: application.createdAt || null,
    reviewedAt: application.reviewedAt || null,
  }));
}

function getMentoringRequestItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.requests)) {
    return rawValue.requests;
  }

  return [];
}

function normalizeSentRequests(rawValue) {
  return getMentoringRequestItems(rawValue).map((request, index) => ({
    id: request.id ?? `mentoring-request-${index}`,
    requesterId: request.requesterId ?? request.senderId ?? request.userId ?? null,
    requesterLabel:
      request.requesterNickname ||
      request.requesterName ||
      request.senderNickname ||
      request.userNickname ||
      '나',
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      `사용자 ${request.mentorId ?? request.receiverId ?? request.targetUserId ?? '?'}`,
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
    createdAt: request.createdAt || request.timestamp || null,
  }));
}

function normalizeReceivedRequests(rawValue) {
  return getMentoringRequestItems(rawValue).map((request, index) => ({
    id: request.id ?? `mentoring-request-${index}`,
    requesterId: request.requesterId ?? request.senderId ?? request.userId ?? null,
    requesterLabel:
      request.requesterNickname ||
      request.requesterName ||
      request.senderNickname ||
      request.userNickname ||
      `사용자 ${request.requesterId ?? request.senderId ?? request.userId ?? '?'}`,
    mentorId: request.mentorId ?? request.receiverId ?? request.targetUserId ?? null,
    mentorLabel:
      request.mentorNickname ||
      request.mentorName ||
      request.receiverNickname ||
      request.targetNickname ||
      '나',
    message: request.message || request.content || '',
    status: request.status || 'PENDING',
    createdAt: request.createdAt || request.timestamp || null,
  }));
}

function getReservationItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.reservations)) {
    return rawValue.reservations;
  }

  return [];
}

function normalizeReservations(rawValue) {
  return getReservationItems(rawValue).map((reservation, index) => ({
    id: reservation.id ?? `mentoring-reservation-${index}`,
    requesterId: reservation.requesterId ?? reservation.senderId ?? reservation.userId ?? null,
    requesterLabel:
      reservation.requesterLabel ||
      reservation.requesterNickname ||
      reservation.requesterName ||
      reservation.senderNickname ||
      reservation.userNickname ||
      `사용자 ${reservation.requesterId ?? reservation.senderId ?? reservation.userId ?? '?'}`,
    mentorId: reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? null,
    mentorLabel:
      reservation.mentorLabel ||
      reservation.mentorNickname ||
      reservation.mentorName ||
      reservation.receiverNickname ||
      reservation.targetNickname ||
      `사용자 ${reservation.mentorId ?? reservation.receiverId ?? reservation.targetUserId ?? '?'}`,
    reservedAt: reservation.reservedAt || reservation.scheduledAt || null,
    sessionEntryOpenAt: reservation.sessionEntryOpenAt || null,
    sessionEntryCloseAt: reservation.sessionEntryCloseAt || null,
    message: reservation.message || reservation.content || '',
    status: reservation.status || 'PENDING',
    createdAt: reservation.createdAt || reservation.timestamp || null,
  }));
}

function getNotificationItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.notifications)) {
    return rawValue.notifications;
  }

  return [];
}

function normalizeServerNotification(rawValue) {
  if (!rawValue) {
    return null;
  }

  const notification = rawValue.item || rawValue.notification || rawValue;

  return {
    id: notification.id ?? null,
    type: String(notification.type || '').toUpperCase(),
    title: notification.title || '',
    message: notification.message || '',
    relatedId: notification.relatedId ?? null,
    isRead: Boolean(notification.isRead ?? notification.read),
    createdAt: notification.createdAt || null,
  };
}

function normalizeServerNotifications(rawValue) {
  return getNotificationItems(rawValue)
    .map(normalizeServerNotification)
    .filter(Boolean);
}

function normalizeFeedbackPrompt(rawValue) {
  if (!rawValue) {
    return null;
  }

  const requestId = rawValue.requestId ?? rawValue.id ?? null;

  if (!requestId) {
    return null;
  }

  return {
    requestId,
    counterpartName: rawValue.counterpartName || rawValue.counterpartLabel || '세션 상대',
    role: rawValue.role || 'Participant',
    sessionSource: rawValue.sessionSource || 'request',
    reservedAt: rawValue.reservedAt || null,
    requestMessage: rawValue.requestMessage || rawValue.message || '',
  };
}

function getFeedbackItems(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (Array.isArray(rawValue?.items)) {
    return rawValue.items;
  }

  if (Array.isArray(rawValue?.feedbacks)) {
    return rawValue.feedbacks;
  }

  return [];
}

function normalizeServerFeedback(rawValue) {
  if (!rawValue) {
    return null;
  }

  const feedback = rawValue.item || rawValue.feedback || rawValue;

  return {
    id: feedback.id ?? null,
    requestId: feedback.requestId ?? feedback.reservationId ?? null,
    sessionSource: feedback.sessionSource || 'request',
    counterpartName:
      feedback.targetUserLabel ||
      feedback.counterpartName ||
      feedback.targetNickname ||
      '세션 상대',
    role: feedback.authorRole || feedback.role || 'Participant',
    rating: Number(feedback.rating) || 0,
    summary: feedback.summary || '',
    feedback: feedback.feedback || '',
    reservedAt: feedback.reservedAt || null,
    authorUserId: feedback.authorId ?? feedback.authorUserId ?? null,
    submittedAt: feedback.createdAt || feedback.submittedAt || null,
  };
}

function normalizeFeedbackHistory(rawValue) {
  return getFeedbackItems(rawValue)
    .map(normalizeServerFeedback)
    .filter(Boolean);
}

function normalizeMentorProfiles(rawValue) {
  const mentorItems = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(rawValue?.items)
      ? rawValue.items
      : Array.isArray(rawValue?.mentors)
        ? rawValue.mentors
        : [];

  return mentorItems.map((mentor, index) => ({
    id: mentor.id ?? `mentor-${index}`,
    nickname: mentor.nickname || `멘토 ${index + 1}`,
    role: mentor.role || 'MENTOR',
    bio: mentor.bio || '',
    interests: mentor.interests || '',
    specialties: mentor.specialties || '',
    avatarUrl: mentor.avatarUrl || '',
    mentorEnabled: Boolean(mentor.mentorEnabled ?? true),
    availabilitySlots: normalizeAvailabilitySlots(mentor.availabilitySlots),
    courses: normalizeMentorCourses(mentor.courses),
  }));
}

function getTimestampValue(value) {
  if (!value) {
    return 0;
  }

  const parsedTime = new Date(value).getTime();
  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

function sortByRecent(items, selector) {
  return [...items].sort((leftItem, rightItem) => selector(rightItem) - selector(leftItem));
}

function sortFeedbackHistory(feedbackItems) {
  return sortByRecent(feedbackItems, (feedbackItem) => getTimestampValue(feedbackItem.submittedAt));
}

function formatDateTime(value, fallback = '') {
  if (!value) {
    return fallback;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
}

function formatFeedbackTimestamp(value) {
  return formatDateTime(value);
}

function formatHistorySessionLabel(feedbackItem) {
  const sessionType = feedbackItem.sessionSource === 'reservation' ? '예약' : '요청';
  return `${sessionType} #${feedbackItem.requestId}`;
}

function formatReservationTimestamp(value) {
  return formatDateTime(value, '예약 시간이 없습니다');
}

function formatParticipantRole(role) {
  if (role === 'Requester') {
    return '요청자';
  }

  if (role === 'Mentor') {
    return '멘토';
  }

  return '참여자';
}

function formatSessionSourceLabel(sessionSource) {
  return sessionSource === 'reservation' ? '예약 멘토링' : '요청 멘토링';
}

function formatRequestStatus(status) {
  if (status === 'PENDING') {
    return '대기 중';
  }

  if (status === 'ACCEPTED') {
    return '수락됨';
  }

  if (status === 'REJECTED') {
    return '거절됨';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatReservationStatus(status) {
  if (status === 'PENDING') {
    return '대기 중';
  }

  if (status === 'ACCEPTED') {
    return '수락됨';
  }

  if (status === 'REJECTED') {
    return '거절됨';
  }

  if (status === 'CANCELED') {
    return '취소됨';
  }

  if (status === 'COMPLETED') {
    return '종료됨';
  }

  return status || '알 수 없음';
}

function formatCourseApplicationStatus(status) {
  if (status === 'PENDING') {
    return '검토 중';
  }

  if (status === 'APPROVED') {
    return '승인됨';
  }

  if (status === 'REJECTED') {
    return '반려됨';
  }

  if (status === 'CANCELED') {
    return '취소됨';
  }

  return status || '알 수 없음';
}

function formatMentorCourseStatus(status) {
  if (status === 'PUBLISHED') {
    return '공개 중';
  }

  if (status === 'ARCHIVED') {
    return '보관됨';
  }

  return '초안';
}

function formatMeetingTypeLabel(meetingType) {
  if (meetingType === 'ONLINE') {
    return '온라인';
  }

  if (meetingType === 'OFFLINE') {
    return '오프라인';
  }

  if (meetingType === 'HYBRID') {
    return '온오프라인';
  }

  return meetingType || '미정';
}

function formatCurrency(value) {
  const numericValue = Number(value) || 0;
  return numericValue === 0 ? '무료' : `${numericValue.toLocaleString()}원`;
}

function formatAvailabilitySlot(slot) {
  return `${DAY_OF_WEEK_LABELS[slot.dayOfWeek] || slot.dayOfWeek} ${slot.startTime} - ${slot.endTime}`;
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function formatMentorApplicationStatus(status) {
  if (status === 'PENDING') {
    return '검토 중';
  }

  if (status === 'APPROVED') {
    return '승인됨';
  }

  if (status === 'REJECTED') {
    return '반려됨';
  }

  return status || '미신청';
}

function normalizeAdminDashboard(rawValue) {
  if (!rawValue) {
    return null;
  }

  const dashboard = rawValue.item || rawValue.dashboard || rawValue;

  return {
    mentorCount: Number(dashboard.mentorCount ?? 0) || 0,
    visibleMentorCount: Number(dashboard.visibleMentorCount ?? 0) || 0,
    publishedCourseCount: Number(dashboard.publishedCourseCount ?? 0) || 0,
    pendingMentorApplicationCount:
      Number(dashboard.pendingMentorApplicationCount ?? 0) || 0,
    pendingCourseApplicationCount:
      Number(dashboard.pendingCourseApplicationCount ?? 0) || 0,
    pendingMentorApplications: Array.isArray(dashboard.pendingMentorApplications)
      ? dashboard.pendingMentorApplications
      : [],
    pendingCourseApplications: Array.isArray(dashboard.pendingCourseApplications)
      ? dashboard.pendingCourseApplications
      : [],
    mentors: Array.isArray(dashboard.mentors)
      ? dashboard.mentors.map((mentor, index) => ({
          id: mentor.id ?? `admin-mentor-${index}`,
          nickname: mentor.nickname || '멘토',
          email: mentor.email || '',
          mentorEnabled: Boolean(mentor.mentorEnabled ?? true),
          specialties: mentor.specialties || '',
          courseCount: Number(mentor.courseCount ?? 0) || 0,
          publishedCourseCount: Number(mentor.publishedCourseCount ?? 0) || 0,
          pendingCourseApplicationCount:
            Number(mentor.pendingCourseApplicationCount ?? 0) || 0,
        }))
      : [],
    courses: Array.isArray(dashboard.courses)
      ? dashboard.courses.map((course, index) => ({
          id: course.id ?? `admin-course-${index}`,
          title: course.title || '수업',
          mentorId: course.mentorId ?? null,
          mentorNickname: course.mentorNickname || '멘토',
          status: course.status || 'DRAFT',
          price: Number(course.price ?? 0) || 0,
          capacity: Number(course.capacity ?? 0) || 0,
          approvedApplicationCount: Number(course.approvedApplicationCount ?? 0) || 0,
          remainingCapacity: Number(course.remainingCapacity ?? 0) || 0,
          pendingApplicationCount: Number(course.pendingApplicationCount ?? 0) || 0,
        }))
      : [],
  };
}

function formatReservationEntryStatusLabel(entryState) {
  if (!entryState) {
    return '입장 상태를 확인할 수 없습니다.';
  }

  if (entryState.status === 'upcoming') {
    return '입장 대기 중';
  }

  if (entryState.status === 'ready') {
    return '지금 입장 가능';
  }

  if (entryState.status === 'expired') {
    return '입장 시간 종료';
  }

  return '입장 정보 없음';
}

function formatReservationEntryWindow(entryState) {
  if (!entryState?.entryOpenAt || !entryState?.entryCloseAt) {
    return '입장 가능 시간 정보가 없습니다.';
  }

  return `${formatDateTime(entryState.entryOpenAt)}부터 ${formatDateTime(entryState.entryCloseAt)}까지`;
}

function getReservationAccessCopy(reservation, entryState, perspective = 'sent') {
  if (reservation.status === 'PENDING') {
    return perspective === 'received'
      ? {
          headline: '예약 검토 필요',
          detail: '수락하면 세션 입장 시간이 자동으로 열리고, 거절하면 더 이상 진행되지 않습니다.',
        }
      : {
          headline: '상대 확인 대기 중',
          detail: '상대가 예약을 수락하면 입장 가능 시간이 확정됩니다.',
        };
  }

  if (reservation.status === 'REJECTED') {
    return {
      headline: '예약이 거절되었습니다',
      detail: '이 예약으로는 세션을 시작할 수 없습니다.',
    };
  }

  if (reservation.status === 'CANCELED') {
    return {
      headline: '예약이 취소되었습니다',
      detail: '취소된 예약은 다시 입장할 수 없습니다.',
    };
  }

  if (reservation.status === 'COMPLETED') {
    return {
      headline: '세션이 종료되었습니다',
      detail: '완료된 예약 세션은 허브에서 기록만 확인할 수 있습니다.',
    };
  }

  if (entryState?.status === 'ready') {
    return {
      headline: '지금 세션에 입장할 수 있습니다',
      detail: '입장 버튼이 활성화되면 바로 세션 화면으로 이동할 수 있습니다.',
    };
  }

  if (entryState?.status === 'upcoming') {
    return {
      headline: '입장 가능 시간 전입니다',
      detail: '예약 시작 10분 전부터 세션 입장이 열립니다.',
    };
  }

  if (entryState?.status === 'expired') {
    return {
      headline: '입장 가능 시간이 종료되었습니다',
      detail: '세션 입장 가능 시간이 지나 더 이상 이 예약으로는 입장할 수 없습니다.',
    };
  }

  return {
    headline: '입장 상태를 확인할 수 없습니다',
    detail: '예약 정보가 완전하지 않아 세션 입장 가능 여부를 계산하지 못했습니다.',
  };
}

function formatNotificationTypeLabel(type) {
  if (type === 'request_accepted') {
    return '요청 수락';
  }

  if (type === 'reservation_accepted') {
    return '예약 수락';
  }

  if (type === 'reservation_ready') {
    return '세션 입장';
  }

  return '알림';
}

function getStatusTone(status) {
  if (status === 'PENDING') {
    return 'pending';
  }

  if (status === 'ACCEPTED') {
    return 'accepted';
  }

  if (status === 'REJECTED' || status === 'CANCELED') {
    return 'muted';
  }

  if (status === 'COMPLETED') {
    return 'info';
  }

  return 'info';
}

function buildHubNotifications({
  serverNotifications,
  sentRequests,
  reservations,
  receivedReservations,
  nowTimestamp,
  dismissedNotificationIds,
}) {
  const notifications = [];
  const notificationPriority = {
    reservation_ready: 0,
    request_accepted: 1,
    reservation_accepted: 2,
  };

  serverNotifications.forEach((notification) => {
    if (notification.isRead) {
      return;
    }

    if (notification.type === 'REQUEST_ACCEPTED') {
      const request = sentRequests.find(
        (requestItem) => String(requestItem.id) === String(notification.relatedId)
      );

      notifications.push({
        ...notification,
        source: 'server',
        type: 'request_accepted',
        actionType: request?.status === 'ACCEPTED' ? 'enter_request_session' : 'view_requests',
        actionLabel: request?.status === 'ACCEPTED' ? '세션 입장' : '내 진행 보기',
        request,
        title:
          request?.status === 'ACCEPTED'
            ? '멘토링 요청이 수락되었습니다'
            : '요청 상태가 업데이트되었습니다',
        message:
          request?.status === 'ACCEPTED'
            ? `${request?.mentorLabel || '상대방'} 님이 멘토링 요청을 수락했습니다.`
            : notification.message,
      });
      return;
    }

    if (notification.type === 'RESERVATION_ACCEPTED') {
      const reservation = reservations.find(
        (reservationItem) => String(reservationItem.id) === String(notification.relatedId)
      );
      const entryState =
        reservation?.status === 'ACCEPTED'
          ? getReservationEntryState(reservation, nowTimestamp)
          : null;

      if (entryState?.status === 'ready') {
        return;
      }

      notifications.push({
        ...notification,
        source: 'server',
        type: 'reservation_accepted',
        actionType: 'view_my_reservations',
        actionLabel: '내 진행 보기',
        reservation,
        title: '멘토링 예약이 수락되었습니다',
        message:
          reservation
            ? `${reservation.mentorLabel} 님과의 예약이 확정되었습니다.`
            : notification.message,
      });
    }
  });

  reservations.forEach((reservation) => {
    if (reservation.status !== 'ACCEPTED') {
      return;
    }

    const entryState = getReservationEntryState(reservation, nowTimestamp);

    if (entryState.status !== 'ready') {
      return;
    }

    notifications.push({
      id: `reservation-ready-my-${reservation.id}`,
      source: 'computed',
      type: 'reservation_ready',
      title: '예약 세션에 입장할 수 있습니다',
      message: `${reservation.mentorLabel} 님과의 예약 세션이 시작되었습니다.`,
      relatedId: reservation.id,
      actionType: 'enter_reservation_session',
      actionLabel: '세션 입장',
      reservation,
      isRead: false,
      createdAt: reservation.reservedAt || reservation.createdAt || null,
    });
  });

  receivedReservations.forEach((reservation) => {
    if (reservation.status !== 'ACCEPTED') {
      return;
    }

    const entryState = getReservationEntryState(reservation, nowTimestamp);

    if (entryState.status !== 'ready') {
      return;
    }

    notifications.push({
      id: `reservation-ready-received-${reservation.id}`,
      source: 'computed',
      type: 'reservation_ready',
      title: '수락한 예약 세션에 입장할 수 있습니다',
      message: `${reservation.requesterLabel} 님과의 예약 멘토링을 지금 시작할 수 있습니다.`,
      relatedId: reservation.id,
      actionType: 'enter_reservation_session',
      actionLabel: '세션 입장',
      reservation,
      isRead: false,
      createdAt: reservation.reservedAt || reservation.createdAt || null,
    });
  });

  return notifications
    .filter(
      (notification) =>
        notification.source === 'server' || !dismissedNotificationIds.includes(notification.id)
    )
    .sort((leftNotification, rightNotification) => {
      const priorityDifference =
        (notificationPriority[leftNotification.type] ?? 99) -
        (notificationPriority[rightNotification.type] ?? 99);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        getTimestampValue(rightNotification.createdAt) -
        getTimestampValue(leftNotification.createdAt)
      );
    });
}

function getDefaultReservationDateTime() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const localOffset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - localOffset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function getCategoryEmptyCopy(categoryId) {
  if (categoryId === 'admin_console') {
    return {
      title: '관리자 운영 데이터가 없습니다',
      description: '멘토, 수업, 신청 현황이 준비되면 이곳에서 한 번에 운영할 수 있습니다.',
    };
  }

  if (categoryId === 'received_course_applications') {
    return {
      title: '아직 받은 수업 신청이 없습니다',
      description: '사용자가 공개 수업에 신청하면 이곳에서 승인 여부를 결정할 수 있습니다.',
    };
  }

  if (categoryId === 'received_requests') {
    return {
      title: '아직 받은 멘토링 요청이 없습니다',
      description: '새로운 연결은 메타버스에서 시작됩니다. 광장에서 사람을 만나고 요청을 받아보세요.',
    };
  }

  if (categoryId === 'received_reservations') {
    return {
      title: '아직 받은 예약이 없습니다',
      description: '예약이 도착하면 이곳에서 수락 여부와 입장 시간을 바로 확인할 수 있습니다.',
    };
  }

  if (categoryId === 'my_progress') {
    return {
      title: '진행 중인 요청이나 예약이 없습니다',
      description: '메타버스에서 관계를 만들면 내 진행 목록이 이곳에 쌓입니다.',
    };
  }

  if (categoryId === 'mentor_application') {
    return {
      title: '검토할 멘토 신청이 없습니다',
      description: '새 멘토 신청이 들어오면 이곳에서 승인 여부를 결정할 수 있습니다.',
    };
  }

  if (categoryId === 'notifications') {
    return {
      title: '새 알림이 없습니다',
      description: '세션 입장 가능 상태나 수락된 요청은 이곳에서 가장 먼저 확인할 수 있습니다.',
    };
  }

  return {
    title: '아직 세션 기록이 없습니다',
    description: '멘토링 세션을 마치고 피드백을 남기면 이곳에 기록이 정리됩니다.',
  };
}

export default function HubPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isMentorAccount =
    currentUser?.role === 'MENTOR' || currentUser?.role === 'ADMIN';
  const currentRoleLabel =
    currentUser?.role === 'ADMIN'
      ? '관리자'
      : currentUser?.role === 'MENTOR'
        ? '멘토'
        : '일반 사용자';

  const [spaces, setSpaces] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [mentorProfiles, setMentorProfiles] = useState([]);
  const [mentorApplication, setMentorApplication] = useState(null);
  const [pendingMentorApplications, setPendingMentorApplications] = useState([]);
  const [adminDashboard, setAdminDashboard] = useState(null);
  const [myCourseApplications, setMyCourseApplications] = useState([]);
  const [receivedCourseApplications, setReceivedCourseApplications] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [receivedReservations, setReceivedReservations] = useState([]);
  const [serverNotifications, setServerNotifications] = useState([]);
  const [feedbackHistory, setFeedbackHistory] = useState([]);
  const [feedbackPrompt, setFeedbackPrompt] = useState(
    normalizeFeedbackPrompt(location.state?.feedbackPrompt)
  );
  const [feedbackRating, setFeedbackRating] = useState('5');
  const [feedbackSummary, setFeedbackSummary] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('idle');
  const [feedbackNotice, setFeedbackNotice] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [pageNotice, setPageNotice] = useState(
    location.state?.sessionMessage || location.state?.message || ''
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const [requestActionError, setRequestActionError] = useState('');
  const [reservationError, setReservationError] = useState('');
  const [receivedReservationError, setReceivedReservationError] = useState('');
  const [receivedReservationNotice, setReceivedReservationNotice] = useState('');
  const [isReadingAllNotifications, setIsReadingAllNotifications] = useState(false);
  const [activeNotificationId, setActiveNotificationId] = useState(null);
  const [activeRequestActionId, setActiveRequestActionId] = useState(null);
  const [activeReservationActionId, setActiveReservationActionId] = useState(null);
  const [activeReceivedReservationActionId, setActiveReceivedReservationActionId] =
    useState(null);
  const [mentoringMessage, setMentoringMessage] = useState('');
  const [mentorApplicationBio, setMentorApplicationBio] = useState('');
  const [mentorApplicationSpecialties, setMentorApplicationSpecialties] = useState('');
  const [mentorApplicationInterests, setMentorApplicationInterests] = useState('');
  const [mentorApplicationReason, setMentorApplicationReason] = useState('');
  const [mentorApplicationReviewNote, setMentorApplicationReviewNote] = useState('');
  const [mentorApplicationNotice, setMentorApplicationNotice] = useState('');
  const [mentorApplicationError, setMentorApplicationError] = useState('');
  const [mentorApplicationStatus, setMentorApplicationStatus] = useState('idle');
  const [activeMentorApplicationId, setActiveMentorApplicationId] = useState(null);
  const [activeAdminMentorId, setActiveAdminMentorId] = useState(null);
  const [activeAdminCourseId, setActiveAdminCourseId] = useState(null);
  const [adminConsoleNotice, setAdminConsoleNotice] = useState('');
  const [adminConsoleError, setAdminConsoleError] = useState('');
  const [mentorManagementProfile, setMentorManagementProfile] = useState(null);
  const [mentorProfileBio, setMentorProfileBio] = useState('');
  const [mentorProfileInterests, setMentorProfileInterests] = useState('');
  const [mentorProfileSpecialties, setMentorProfileSpecialties] = useState('');
  const [mentorProfileAvatarUrl, setMentorProfileAvatarUrl] = useState('');
  const [mentorProfileEnabled, setMentorProfileEnabled] = useState(true);
  const [mentorProfileNotice, setMentorProfileNotice] = useState('');
  const [mentorProfileError, setMentorProfileError] = useState('');
  const [mentorProfileStatus, setMentorProfileStatus] = useState('idle');
  const [mentorAvailabilityDrafts, setMentorAvailabilityDrafts] = useState([]);
  const [mentorAvailabilityNotice, setMentorAvailabilityNotice] = useState('');
  const [mentorAvailabilityError, setMentorAvailabilityError] = useState('');
  const [mentorAvailabilityStatus, setMentorAvailabilityStatus] = useState('idle');
  const [mentorCourseForm, setMentorCourseForm] = useState(DEFAULT_MENTOR_COURSE_FORM);
  const [mentorCourseFormMode, setMentorCourseFormMode] = useState('create');
  const [editingMentorCourseId, setEditingMentorCourseId] = useState(null);
  const [mentorCourseNotice, setMentorCourseNotice] = useState('');
  const [mentorCourseError, setMentorCourseError] = useState('');
  const [mentorCourseStatus, setMentorCourseStatus] = useState('idle');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseApplicationMessage, setCourseApplicationMessage] = useState('');
  const [courseApplicationReviewNote, setCourseApplicationReviewNote] = useState('');
  const [courseApplicationNotice, setCourseApplicationNotice] = useState('');
  const [courseApplicationError, setCourseApplicationError] = useState('');
  const [courseApplicationStatus, setCourseApplicationStatus] = useState('idle');
  const [activeCourseApplicationId, setActiveCourseApplicationId] = useState(null);
  const [mentoringFeedback, setMentoringFeedback] = useState('');
  const [mentoringError, setMentoringError] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [reservationDateTime, setReservationDateTime] = useState(getDefaultReservationDateTime);
  const [reservationCreateMessage, setReservationCreateMessage] = useState('');
  const [reservationCreateNotice, setReservationCreateNotice] = useState('');
  const [reservationCreateError, setReservationCreateError] = useState('');
  const [reservationCreateStatus, setReservationCreateStatus] = useState('idle');
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState([]);
  const [reservationClock, setReservationClock] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('received_requests');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [mentorFilters, setMentorFilters] = useState(DEFAULT_MENTOR_FILTERS);

  const primarySpacePath = useMemo(() => {
    const resolvedPath = getPrimarySpacePathFromSpaces(spaces);
    return resolvedPath === '/hub' ? '/lobby' : resolvedPath;
  }, [spaces]);

  const lobbyNotifications = useMemo(
    () =>
      buildHubNotifications({
        serverNotifications,
        sentRequests,
        reservations,
        receivedReservations,
        nowTimestamp: reservationClock,
        dismissedNotificationIds,
      }),
    [dismissedNotificationIds, receivedReservations, reservationClock, reservations, sentRequests, serverNotifications]
  );

  const pendingRequestCount = useMemo(
    () => receivedRequests.filter((request) => request.status === 'PENDING').length,
    [receivedRequests]
  );
  const pendingReservationCount = useMemo(
    () => receivedReservations.filter((reservation) => reservation.status === 'PENDING').length,
    [receivedReservations]
  );
  const pendingCourseApplicationCount = useMemo(
    () =>
      receivedCourseApplications.filter((application) => application.status === 'PENDING').length,
    [receivedCourseApplications]
  );
  const activeSessionCount = useMemo(() => {
    const acceptedRequests =
      sentRequests.filter((request) => request.status === 'ACCEPTED').length +
      receivedRequests.filter((request) => request.status === 'ACCEPTED').length;
    const readyReservations =
      reservations.filter(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          getReservationEntryState(reservation, reservationClock).canEnter
      ).length +
      receivedReservations.filter(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          getReservationEntryState(reservation, reservationClock).canEnter
      ).length;

    return acceptedRequests + readyReservations;
  }, [receivedRequests, receivedReservations, reservationClock, reservations, sentRequests]);
  const unreadNotificationCount = lobbyNotifications.length;
  const feedbackItemCount = feedbackHistory.length + (feedbackPrompt ? 1 : 0);
  const hasUnreadServerNotifications = serverNotifications.some((notification) => !notification.isRead);
  const isFeedbackLocked =
    feedbackStatus === 'saving' || (Boolean(feedbackPrompt) && feedbackStatus === 'saved');
  const availableMentors = useMemo(
    () =>
      mentorProfiles.filter(
        (mentor) =>
          mentor.mentorEnabled &&
          String(mentor.id) !== String(currentUser?.id)
      ),
    [currentUser?.id, mentorProfiles]
  );
  const filteredAvailableMentors = useMemo(() => {
    const keyword = normalizeSearchText(mentorFilters.keyword);

    const filteredMentors = availableMentors.filter((mentor) => {
      const matchesKeyword =
        !keyword ||
        [
          mentor.nickname,
          mentor.bio,
          mentor.interests,
          mentor.specialties,
          ...(mentor.courses || []).flatMap((course) => [
            course.title,
            course.summary,
            course.description,
          ]),
        ]
          .map(normalizeSearchText)
          .some((value) => value.includes(keyword));

      const matchesDayOfWeek =
        mentorFilters.dayOfWeek === 'ALL' ||
        (mentor.availabilitySlots || []).some(
          (slot) => slot.dayOfWeek === mentorFilters.dayOfWeek
        );

      const matchesMeetingType =
        mentorFilters.meetingType === 'ALL' ||
        (mentor.courses || []).some(
          (course) => course.meetingType === mentorFilters.meetingType
        );

      const matchesMaxPrice =
        mentorFilters.maxPrice === 'ALL' ||
        (mentor.courses || []).some(
          (course) => Number(course.price || 0) <= Number(mentorFilters.maxPrice)
        );

      return matchesKeyword && matchesDayOfWeek && matchesMeetingType && matchesMaxPrice;
    });

    return [...filteredMentors].sort((leftMentor, rightMentor) => {
      if (mentorFilters.sort === 'price_low') {
        const leftPrice = Math.min(...(leftMentor.courses || []).map((course) => course.price), Number.MAX_SAFE_INTEGER);
        const rightPrice = Math.min(...(rightMentor.courses || []).map((course) => course.price), Number.MAX_SAFE_INTEGER);
        return leftPrice - rightPrice;
      }

      if (mentorFilters.sort === 'course_count') {
        return (rightMentor.courses?.length || 0) - (leftMentor.courses?.length || 0);
      }

      if (mentorFilters.sort === 'availability') {
        return (rightMentor.availabilitySlots?.length || 0) - (leftMentor.availabilitySlots?.length || 0);
      }

      return leftMentor.nickname.localeCompare(rightMentor.nickname);
    });
  }, [availableMentors, mentorFilters]);
  const mentorApplicationItems = useMemo(() => {
    if (currentUser?.role === 'ADMIN') {
      return pendingMentorApplications.map((application) => ({
        id: `mentor-application-review-${application.id}`,
        kind: 'mentor_application_review',
        title: application.nickname,
        preview: application.reason || '멘토 신청 사유가 없습니다.',
        badge: formatMentorApplicationStatus(application.status),
        tone: application.status === 'PENDING' ? 'pending' : 'info',
        meta: application.specialties || '멘토 지원서',
        raw: application,
      }));
    }

    if (currentUser?.role !== 'USER') {
      return [];
    }

    return [
      {
        id: 'mentor-application-self',
        kind: 'mentor_application_self',
        title: mentorApplication ? '내 멘토 신청' : '멘토 신청하기',
        preview:
          mentorApplication?.reason ||
          '멘토 소개와 전문 분야를 제출하면 관리자 검토 후 멘토 권한이 열립니다.',
        badge: formatMentorApplicationStatus(mentorApplication?.status),
        tone:
          mentorApplication?.status === 'APPROVED'
            ? 'accepted'
            : mentorApplication?.status === 'REJECTED'
              ? 'muted'
              : 'pending',
        meta: mentorApplication?.specialties || '멘토 전환 신청',
        raw: mentorApplication,
      },
    ];
  }, [currentUser?.role, mentorApplication, pendingMentorApplications]);
  const mentorManagementItems = useMemo(() => {
    if (!isMentorAccount) {
      return [];
    }

    return [
      {
        id: 'mentor-management-self',
        kind: 'mentor_management',
        title: mentorManagementProfile?.nickname || currentUser?.nickname || '내 멘토 관리',
        preview:
          mentorManagementProfile?.specialties ||
          mentorManagementProfile?.bio ||
          '소개, 가능 시간, 수업 정보를 여기서 관리합니다.',
        badge: mentorManagementProfile?.mentorEnabled ? '노출 중' : '비노출',
        tone: mentorManagementProfile?.mentorEnabled ? 'accepted' : 'muted',
        meta:
          mentorManagementProfile?.courses?.length > 0
            ? `개설 수업 ${mentorManagementProfile.courses.length}개`
            : '멘토 운영 설정',
        raw: mentorManagementProfile,
      },
    ];
  }, [currentUser?.nickname, isMentorAccount, mentorManagementProfile]);
  const adminConsoleItems = useMemo(() => {
    if (currentUser?.role !== 'ADMIN' || !adminDashboard) {
      return [];
    }

    return [
      {
        id: 'admin-dashboard-summary',
        kind: 'admin_dashboard',
        title: '운영 대시보드',
        preview: `멘토 ${adminDashboard.mentorCount}명, 공개 수업 ${adminDashboard.publishedCourseCount}개`,
        badge: '운영',
        tone: 'info',
        meta: `멘토 지원 ${adminDashboard.pendingMentorApplicationCount}건 · 수업 신청 ${adminDashboard.pendingCourseApplicationCount}건`,
        raw: adminDashboard,
      },
      ...adminDashboard.mentors.map((mentor) => ({
        id: `admin-mentor-${mentor.id}`,
        kind: 'admin_mentor',
        title: mentor.nickname,
        preview: mentor.specialties || '전문 분야 정보 없음',
        badge: mentor.mentorEnabled ? '노출 중' : '비노출',
        tone: mentor.mentorEnabled ? 'accepted' : 'muted',
        meta: `수업 ${mentor.courseCount}개 · 대기 신청 ${mentor.pendingCourseApplicationCount}건`,
        raw: mentor,
      })),
      ...adminDashboard.courses.map((course) => ({
        id: `admin-course-${course.id}`,
        kind: 'admin_course',
        title: course.title,
        preview: `${course.mentorNickname} · ${formatCurrency(course.price)}`,
        badge: formatMentorCourseStatus(course.status),
        tone:
          course.status === 'PUBLISHED'
            ? 'accepted'
            : course.status === 'ARCHIVED'
              ? 'muted'
              : 'info',
        meta: `승인 ${course.approvedApplicationCount}명 · 대기 ${course.pendingApplicationCount}건`,
        raw: course,
      })),
    ];
  }, [adminDashboard, currentUser?.role]);
  const hasActiveMentorFilters = useMemo(
    () =>
      mentorFilters.keyword.trim() !== '' ||
      mentorFilters.dayOfWeek !== 'ALL' ||
      mentorFilters.meetingType !== 'ALL' ||
      mentorFilters.maxPrice !== 'ALL' ||
      mentorFilters.sort !== 'recommended',
    [mentorFilters]
  );

  const categoryItems = useMemo(() => {
    const mentorItems = filteredAvailableMentors.map((mentor) => ({
      id: `mentor-${mentor.id}`,
      kind: 'mentor_profile',
      title: mentor.nickname,
      preview:
        mentor.specialties ||
        mentor.bio ||
        mentor.interests ||
        '프로필 정보는 아직 없지만 멘토링 요청을 보낼 수 있습니다.',
      badge: '멘토',
      tone: 'accepted',
      meta: mentor.specialties || '멘토 프로필',
      raw: mentor,
    }));

    const receivedRequestItems = sortByRecent(receivedRequests, (request) =>
      getTimestampValue(request.createdAt)
    ).map((request) => ({
      id: `received-request-${request.id}`,
      kind: 'received_request',
      title: request.requesterLabel,
      preview: request.message || '보낸 메시지가 없습니다.',
      badge: formatRequestStatus(request.status),
      tone: getStatusTone(request.status),
      meta: request.createdAt ? formatDateTime(request.createdAt) : '받은 요청',
      raw: request,
    }));

    const receivedReservationItems = sortByRecent(receivedReservations, (reservation) =>
      Math.max(getTimestampValue(reservation.reservedAt), getTimestampValue(reservation.createdAt))
    ).map((reservation) => ({
      id: `received-reservation-${reservation.id}`,
      kind: 'received_reservation',
      title: reservation.requesterLabel,
      preview: reservation.message || '예약 메시지가 없습니다.',
      badge: formatReservationStatus(reservation.status),
      tone: getStatusTone(reservation.status),
      meta: formatReservationTimestamp(reservation.reservedAt),
      raw: reservation,
    }));

    const progressRequestItems = sentRequests.map((request) => ({
      id: `progress-request-${request.id}`,
      kind: 'sent_request',
      title: request.mentorLabel,
      preview: request.message || '보낸 메시지가 없습니다.',
      badge: formatRequestStatus(request.status),
      tone: getStatusTone(request.status),
      meta: request.createdAt ? formatDateTime(request.createdAt) : '보낸 요청',
      raw: request,
      sortTime: getTimestampValue(request.createdAt),
    }));

    const progressReservationItems = reservations.map((reservation) => ({
      id: `progress-reservation-${reservation.id}`,
      kind: 'sent_reservation',
      title: reservation.mentorLabel,
      preview: reservation.message || '예약 메시지가 없습니다.',
      badge: formatReservationStatus(reservation.status),
      tone: getStatusTone(reservation.status),
      meta: formatReservationTimestamp(reservation.reservedAt),
      raw: reservation,
      sortTime: Math.max(
        getTimestampValue(reservation.reservedAt),
        getTimestampValue(reservation.createdAt)
      ),
    }));

    const progressCourseApplicationItems = myCourseApplications.map((application) => ({
      id: `progress-course-application-${application.id}`,
      kind: 'sent_course_application',
      title: application.courseTitle,
      preview: application.message || '신청 메시지가 없습니다.',
      badge: formatCourseApplicationStatus(application.status),
      tone: getStatusTone(
        application.status === 'APPROVED'
          ? 'ACCEPTED'
          : application.status === 'REJECTED'
            ? 'REJECTED'
            : application.status === 'CANCELED'
              ? 'CANCELED'
              : 'PENDING'
      ),
      meta: application.createdAt ? formatDateTime(application.createdAt) : '수업 신청',
      raw: application,
      sortTime: Math.max(
        getTimestampValue(application.reviewedAt),
        getTimestampValue(application.createdAt)
      ),
    }));

    const progressItems = [
      ...progressRequestItems,
      ...progressReservationItems,
      ...progressCourseApplicationItems,
    ].sort(
      (leftItem, rightItem) => rightItem.sortTime - leftItem.sortTime
    );

    const receivedCourseApplicationItems = sortByRecent(
      receivedCourseApplications,
      (application) => Math.max(getTimestampValue(application.reviewedAt), getTimestampValue(application.createdAt))
    ).map((application) => ({
      id: `received-course-application-${application.id}`,
      kind: 'received_course_application',
      title: application.courseTitle,
      preview: application.message || '신청 메시지가 없습니다.',
      badge: formatCourseApplicationStatus(application.status),
      tone: getStatusTone(
        application.status === 'APPROVED'
          ? 'ACCEPTED'
          : application.status === 'REJECTED'
            ? 'REJECTED'
            : application.status === 'CANCELED'
              ? 'CANCELED'
              : 'PENDING'
      ),
      meta: application.applicantNickname || '신청자',
      raw: application,
    }));

    const notificationItems = lobbyNotifications.map((notification) => ({
      id: `notification-${notification.id}`,
      kind: 'notification',
      title: notification.title,
      preview: notification.message,
      badge: formatNotificationTypeLabel(notification.type),
      tone: notification.type === 'reservation_ready' ? 'accepted' : 'info',
      meta: notification.createdAt ? formatDateTime(notification.createdAt) : '새 알림',
      unread: !notification.isRead,
      raw: notification,
    }));

    const feedbackItems = [
      ...(feedbackPrompt
        ? [
            {
              id: `feedback-prompt-${feedbackPrompt.requestId}`,
              kind: 'feedback_prompt',
              title: `${feedbackPrompt.counterpartName} 세션 피드백`,
              preview: feedbackPrompt.requestMessage || '세션을 마친 뒤 짧은 후기를 남겨 주세요.',
              badge: '작성 필요',
              tone: 'pending',
              meta: feedbackPrompt.reservedAt
                ? formatReservationTimestamp(feedbackPrompt.reservedAt)
                : formatSessionSourceLabel(feedbackPrompt.sessionSource),
              raw: feedbackPrompt,
            },
          ]
        : []),
      ...feedbackHistory.map((feedbackItem) => ({
        id: `feedback-history-${feedbackItem.id ?? `${feedbackItem.sessionSource}-${feedbackItem.requestId}`}`,
        kind: 'feedback_history',
        title: feedbackItem.counterpartName || '세션 상대',
        preview: feedbackItem.summary || feedbackItem.feedback || '저장된 세션 요약이 없습니다.',
        badge: `${feedbackItem.rating || 0}/5`,
        tone: 'info',
        meta: formatFeedbackTimestamp(feedbackItem.submittedAt),
        raw: feedbackItem,
      })),
    ];

    const nextItems = {
      find_mentors: mentorItems,
      received_course_applications: receivedCourseApplicationItems,
      received_requests: receivedRequestItems,
      received_reservations: receivedReservationItems,
      my_progress: progressItems,
      notifications: notificationItems,
      feedback: feedbackItems,
    };

    if (mentorApplicationItems.length > 0) {
      nextItems.mentor_application = mentorApplicationItems;
    }

    if (mentorManagementItems.length > 0) {
      nextItems.mentor_management = mentorManagementItems;
    }

    if (adminConsoleItems.length > 0) {
      nextItems.admin_console = adminConsoleItems;
    }

    return nextItems;
  }, [
    adminConsoleItems,
    filteredAvailableMentors,
    feedbackHistory,
    feedbackPrompt,
    lobbyNotifications,
    mentorApplicationItems,
    mentorManagementItems,
    myCourseApplications,
    receivedCourseApplications,
    receivedRequests,
    receivedReservations,
    reservations,
    sentRequests,
  ]);

  const categoryDefinitions = useMemo(() => {
    const sharedDefinitions = [
      {
        id: 'find_mentors',
        label: '멘토 찾기',
        count: filteredAvailableMentors.length,
      },
      {
        id: 'my_progress',
        label: '내 진행',
        count: sentRequests.length + reservations.length + myCourseApplications.length,
      },
      {
        id: 'notifications',
        label: '알림',
        count: unreadNotificationCount,
      },
      {
        id: 'feedback',
        label: '세션 기록',
        count: feedbackItemCount,
      },
    ];

    if (mentorApplicationItems.length > 0) {
      sharedDefinitions.unshift({
        id: 'mentor_application',
        label: currentUser?.role === 'ADMIN' ? '멘토 지원' : '멘토 신청',
        count: mentorApplicationItems.length,
      });
    }

    if (mentorManagementItems.length > 0) {
      sharedDefinitions.unshift({
        id: 'mentor_management',
        label: '멘토 관리',
        count: mentorManagementItems.length,
      });
    }

    if (adminConsoleItems.length > 0) {
      sharedDefinitions.unshift({
        id: 'admin_console',
        label: '운영 콘솔',
        count: adminConsoleItems.length,
      });
    }

    if (!isMentorAccount) {
      return sharedDefinitions;
    }

    return [
      {
        id: 'received_course_applications',
        label: '받은 수업 신청',
        count: pendingCourseApplicationCount,
      },
      {
        id: 'received_requests',
        label: '받은 요청',
        count: pendingRequestCount,
      },
      {
        id: 'received_reservations',
        label: '받은 예약',
        count: pendingReservationCount,
      },
      ...sharedDefinitions,
    ];
  }, [
    filteredAvailableMentors.length,
    currentUser?.role,
    adminConsoleItems.length,
    feedbackItemCount,
    isMentorAccount,
    mentorApplicationItems.length,
    mentorManagementItems.length,
    pendingCourseApplicationCount,
    pendingRequestCount,
    pendingReservationCount,
    reservations.length,
    myCourseApplications.length,
    sentRequests.length,
    unreadNotificationCount,
  ]);

  const recommendedCategory = useMemo(() => {
    if (feedbackPrompt) {
      return 'feedback';
    }

    if (currentUser?.role === 'USER') {
      return 'mentor_application';
    }

    if (currentUser?.role === 'ADMIN' && pendingMentorApplications.length > 0) {
      return 'mentor_application';
    }

    if (currentUser?.role === 'ADMIN' && adminConsoleItems.length > 0) {
      return 'admin_console';
    }

    if (isMentorAccount) {
      return 'mentor_management';
    }

    if (!isMentorAccount && filteredAvailableMentors.length > 0) {
      return 'find_mentors';
    }

    if (unreadNotificationCount > 0) {
      return 'notifications';
    }

    if (isMentorAccount && pendingRequestCount > 0) {
      return 'received_requests';
    }

    if (isMentorAccount && pendingCourseApplicationCount > 0) {
      return 'received_course_applications';
    }

    if (isMentorAccount && pendingReservationCount > 0) {
      return 'received_reservations';
    }

    if (sentRequests.length + reservations.length + myCourseApplications.length > 0) {
      return 'my_progress';
    }

    return isMentorAccount ? 'feedback' : 'find_mentors';
  }, [
    filteredAvailableMentors.length,
    currentUser?.role,
    adminConsoleItems.length,
    feedbackPrompt,
    isMentorAccount,
    pendingMentorApplications.length,
    pendingCourseApplicationCount,
    pendingRequestCount,
    pendingReservationCount,
    reservations.length,
    myCourseApplications.length,
    sentRequests.length,
    unreadNotificationCount,
  ]);

  const activeItems = categoryItems[activeCategory] || [];
  const selectedItem =
    activeItems.find((item) => item.id === selectedItemId) || activeItems[0] || null;

  const sectionSummaryItems = isMentorAccount
    ? currentUser?.role === 'ADMIN'
      ? [
          { label: '운영 멘토', value: adminDashboard?.mentorCount ?? 0 },
          { label: '공개 멘토', value: adminDashboard?.visibleMentorCount ?? 0 },
          { label: '공개 수업', value: adminDashboard?.publishedCourseCount ?? 0 },
          { label: '새 알림', value: unreadNotificationCount },
        ]
      : [
          { label: '받은 수업 신청', value: pendingCourseApplicationCount },
          { label: '받은 요청', value: pendingRequestCount },
          { label: '받은 예약', value: pendingReservationCount },
          { label: '새 알림', value: unreadNotificationCount },
        ]
    : [
        { label: '멘토 프로필', value: filteredAvailableMentors.length },
        { label: '내 진행', value: sentRequests.length + reservations.length + myCourseApplications.length },
        { label: '새 알림', value: unreadNotificationCount },
      ];

  function focusCategory(categoryId, itemId = null) {
    setActiveCategory(categoryId);
    if (itemId) {
      setSelectedItemId(itemId);
    }
  }

  function syncMentorManagementState(rawProfile) {
    const normalizedProfile = normalizeMentorManagementProfile(rawProfile);

    setMentorManagementProfile(normalizedProfile);
    setMentorProfileBio(normalizedProfile?.bio || '');
    setMentorProfileInterests(normalizedProfile?.interests || '');
    setMentorProfileSpecialties(normalizedProfile?.specialties || '');
    setMentorProfileAvatarUrl(normalizedProfile?.avatarUrl || '');
    setMentorProfileEnabled(Boolean(normalizedProfile?.mentorEnabled ?? true));
    setMentorAvailabilityDrafts(
      normalizedProfile?.availabilitySlots?.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })) || []
    );
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Access token 기반 세션이라 서버 로그아웃 실패 시에도 로컬 상태를 정리한다.
    } finally {
      clearAuth();
      navigate('/login', { replace: true });
    }
  }

  function handleEnterMetaverse() {
    navigate(primarySpacePath);
  }

  function openMentoringSession(request) {
    navigate(`/mentoring/session/${request.id}?type=request`, {
      state: { request },
    });
  }

  function openReservationSession(reservation) {
    navigate(`/mentoring/session/${reservation.id}?type=reservation`, {
      state: { reservation },
    });
  }

  async function refreshMentoringRequests() {
    const [sentRequestsResponse, receivedRequestsResponse] = await Promise.all([
      getSentMentoringRequests(),
      getReceivedMentoringRequests(),
    ]);

    setSentRequests(normalizeSentRequests(sentRequestsResponse));
    setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
  }

  async function refreshMentorProfiles() {
    setMentorProfiles(normalizeMentorProfiles(await getMentors()));
  }

  async function refreshCourseApplications() {
    const [myApplicationsResponse, receivedApplicationsResponse] = await Promise.all([
      getMyMentorCourseApplications(),
      isMentorAccount ? getReceivedMentorCourseApplications() : Promise.resolve([]),
    ]);

    setMyCourseApplications(normalizeMentorCourseApplications(myApplicationsResponse));
    setReceivedCourseApplications(normalizeMentorCourseApplications(receivedApplicationsResponse));
  }

  async function refreshMentorManagementProfile() {
    syncMentorManagementState(await getMyMentorProfile());
  }

  async function refreshMyMentorApplication() {
    try {
      setMentorApplication(await getMyMentorApplication());
    } catch (error) {
      if (error?.response?.status === 404) {
        setMentorApplication(null);
        return;
      }

      throw error;
    }
  }

  async function refreshPendingMentorApplications() {
    setPendingMentorApplications(await getPendingMentorApplications());
  }

  async function refreshAdminDashboard() {
    if (currentUser?.role !== 'ADMIN') {
      setAdminDashboard(null);
      return;
    }

    setAdminDashboard(normalizeAdminDashboard(await getAdminDashboard()));
  }

  async function refreshReservations() {
    const [myReservationsResponse, receivedReservationsResponse] = await Promise.all([
      getMyReservations(),
      getReceivedReservations(),
    ]);

    setReservations(normalizeReservations(myReservationsResponse));
    setReceivedReservations(normalizeReservations(receivedReservationsResponse));
  }

  async function refreshNotifications() {
    setServerNotifications(normalizeServerNotifications(await getNotifications()));
  }

  async function refreshFeedbackHistory(userId = currentUser?.id) {
    if (!userId) {
      setFeedbackHistory([]);
      return;
    }

    const serverFeedbacks = normalizeFeedbackHistory(await getMySessionFeedbacks());
    setFeedbackHistory(sortFeedbackHistory(serverFeedbacks));
  }

  async function handleMentoringDecision(requestId, decision) {
    setActiveRequestActionId(requestId);
    setRequestActionError('');

    try {
      if (decision === 'accept') {
        await acceptMentoringRequest(requestId);
      } else {
        await rejectMentoringRequest(requestId);
      }

      await refreshMentoringRequests();
      setPageNotice(
        decision === 'accept'
          ? '멘토링 요청을 수락했습니다. 이제 내 활동이나 알림에서 바로 세션에 입장할 수 있습니다.'
          : '멘토링 요청을 거절했습니다.'
      );
      focusCategory('received_requests', `received-request-${requestId}`);
    } catch (error) {
      setRequestActionError(
        error?.response?.data?.message ||
          error.message ||
          '멘토링 요청 상태 변경에 실패했습니다.'
      );
    } finally {
      setActiveRequestActionId(null);
    }
  }

  async function handleReceivedReservationDecision(reservationId, decision) {
    setActiveReceivedReservationActionId(reservationId);
    setReceivedReservationNotice('');
    setReceivedReservationError('');

    try {
      if (decision === 'accept') {
        await acceptReservation(reservationId);
      } else {
        await rejectReservation(reservationId);
      }

      await refreshReservations();
      setReceivedReservationNotice(
        decision === 'accept' ? '예약을 수락했습니다.' : '예약을 거절했습니다.'
      );
      setPageNotice(
        decision === 'accept'
          ? '예약을 수락했습니다. 예약 시간이 되면 내 활동이나 알림에서 세션 입장이 열립니다.'
          : '예약을 거절했습니다.'
      );
      focusCategory('received_reservations', `received-reservation-${reservationId}`);
    } catch (error) {
      setReceivedReservationError(
        error?.response?.data?.message ||
          error.message ||
          '받은 예약 상태 변경에 실패했습니다.'
      );
    } finally {
      setActiveReceivedReservationActionId(null);
    }
  }

  async function handleReservationCancel(reservationId) {
    setActiveReservationActionId(reservationId);
    setReservationError('');

    try {
      await cancelReservation(reservationId);
      await refreshReservations();
      setPageNotice('예약을 취소했습니다.');
      focusCategory('my_progress');
    } catch (error) {
      setReservationError(
        error?.response?.data?.message || error.message || '예약 취소에 실패했습니다.'
      );
    } finally {
      setActiveReservationActionId(null);
    }
  }

  async function handleMentoringSubmit(event, mentorId) {
    event.preventDefault();

    if (!mentorId) {
      setMentoringError('멘토를 먼저 선택해 주세요.');
      setMentoringFeedback('');
      return;
    }

    setIsSubmittingRequest(true);
    setMentoringError('');
    setMentoringFeedback('');

    try {
      await createMentoringRequest({
        mentorId: Number(mentorId),
        message: mentoringMessage.trim(),
      });

      await refreshMentoringRequests();
      setMentoringMessage('');
      setMentoringFeedback('멘토링 요청을 보냈습니다.');
      setPageNotice('멘토링 요청을 보냈습니다. 상태는 내 진행에서 계속 확인할 수 있습니다.');
      focusCategory('my_progress');
    } catch (error) {
      setMentoringError(
        error?.response?.data?.message || error.message || '멘토링 요청 전송에 실패했습니다.'
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  async function handleMentorApplicationSubmit(event) {
    event.preventDefault();

    setMentorApplicationStatus('saving');
    setMentorApplicationNotice('');
    setMentorApplicationError('');

    try {
      const savedApplication = await submitMentorApplication({
        bio: mentorApplicationBio.trim(),
        specialties: mentorApplicationSpecialties.trim(),
        interests: mentorApplicationInterests.trim(),
        reason: mentorApplicationReason.trim(),
      });

      setMentorApplication(savedApplication);
      setMentorApplicationStatus('saved');
      setMentorApplicationNotice('멘토 신청서를 제출했습니다. 관리자 검토 후 결과가 반영됩니다.');
      setPageNotice('멘토 신청서를 제출했습니다.');
      focusCategory('mentor_application', 'mentor-application-self');
    } catch (error) {
      setMentorApplicationStatus('error');
      setMentorApplicationError(
        error?.response?.data?.message || error.message || '멘토 신청 제출에 실패했습니다.'
      );
    }
  }

  async function handleMentorApplicationReview(mentorApplicationId, decision) {
    setActiveMentorApplicationId(mentorApplicationId);
    setMentorApplicationNotice('');
    setMentorApplicationError('');

    try {
      if (decision === 'approve') {
        await approveMentorApplication(mentorApplicationId, {
          reviewNote: mentorApplicationReviewNote.trim(),
        });
      } else {
        await rejectMentorApplication(mentorApplicationId, {
          reviewNote: mentorApplicationReviewNote.trim(),
        });
      }

      await refreshPendingMentorApplications();
      await refreshAdminDashboard();
      setMentorApplicationReviewNote('');
      setMentorApplicationNotice(
        decision === 'approve' ? '멘토 신청을 승인했습니다.' : '멘토 신청을 반려했습니다.'
      );
      setPageNotice(
        decision === 'approve'
          ? '멘토 신청을 승인했습니다.'
          : '멘토 신청을 반려했습니다.'
      );
      focusCategory('mentor_application');
    } catch (error) {
      setMentorApplicationError(
        error?.response?.data?.message || error.message || '멘토 신청 검토에 실패했습니다.'
      );
    } finally {
      setActiveMentorApplicationId(null);
    }
  }

  async function handleMentorProfileSave(event) {
    event.preventDefault();

    setMentorProfileStatus('saving');
    setMentorProfileNotice('');
    setMentorProfileError('');

    try {
      syncMentorManagementState(
        await updateMyMentorProfile({
          bio: mentorProfileBio.trim(),
          interests: mentorProfileInterests.trim(),
          specialties: mentorProfileSpecialties.trim(),
          avatarUrl: mentorProfileAvatarUrl.trim(),
          mentorEnabled: mentorProfileEnabled,
        })
      );
      await Promise.all([refreshMentorProfiles(), refreshNotifications()]);
      if (currentUser?.role === 'ADMIN') {
        await refreshAdminDashboard();
      }
      setMentorProfileStatus('saved');
      setMentorProfileNotice('멘토 프로필을 저장했습니다.');
      setPageNotice('멘토 프로필을 저장했습니다.');
      focusCategory('mentor_management', 'mentor-management-self');
    } catch (error) {
      setMentorProfileStatus('error');
      setMentorProfileError(
        error?.response?.data?.message || error.message || '멘토 프로필 저장에 실패했습니다.'
      );
    }
  }

  function handleAddAvailabilityDraft() {
    setMentorAvailabilityDrafts((currentDrafts) => [...currentDrafts, createAvailabilityDraft()]);
  }

  function handleRemoveAvailabilityDraft(draftId) {
    setMentorAvailabilityDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => String(draft.id) !== String(draftId))
    );
  }

  function handleAvailabilityDraftChange(draftId, field, value) {
    setMentorAvailabilityDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        String(draft.id) === String(draftId) ? { ...draft, [field]: value } : draft
      )
    );
  }

  async function handleMentorAvailabilitySave(event) {
    event.preventDefault();

    setMentorAvailabilityStatus('saving');
    setMentorAvailabilityNotice('');
    setMentorAvailabilityError('');

    try {
      const savedSlots = normalizeAvailabilitySlots(
        await updateMyMentorAvailability({
          slots: mentorAvailabilityDrafts.map((draft) => ({
            dayOfWeek: draft.dayOfWeek,
            startTime: `${draft.startTime}:00`,
            endTime: `${draft.endTime}:00`,
          })),
        })
      );

      setMentorAvailabilityDrafts(savedSlots);
      setMentorManagementProfile((currentProfile) =>
        currentProfile
          ? {
              ...currentProfile,
              availabilitySlots: savedSlots,
            }
          : currentProfile
      );
      await refreshMentorProfiles();
      setMentorAvailabilityStatus('saved');
      setMentorAvailabilityNotice('멘토 가능 시간을 저장했습니다.');
      setPageNotice('멘토 가능 시간을 저장했습니다.');
    } catch (error) {
      setMentorAvailabilityStatus('error');
      setMentorAvailabilityError(
        error?.response?.data?.message || error.message || '멘토 가능 시간 저장에 실패했습니다.'
      );
    }
  }

  function resetMentorCourseEditor() {
    setMentorCourseForm(DEFAULT_MENTOR_COURSE_FORM);
    setMentorCourseFormMode('create');
    setEditingMentorCourseId(null);
  }

  function handleAddCurriculumItem() {
    setMentorCourseForm((currentForm) => ({
      ...currentForm,
      curriculumItems: [...currentForm.curriculumItems, createCurriculumDraft()],
    }));
  }

  function handleCurriculumItemChange(curriculumId, field, value) {
    setMentorCourseForm((currentForm) => ({
      ...currentForm,
      curriculumItems: currentForm.curriculumItems.map((item) =>
        String(item.id) === String(curriculumId) ? { ...item, [field]: value } : item
      ),
    }));
  }

  function handleRemoveCurriculumItem(curriculumId) {
    setMentorCourseForm((currentForm) => {
      const nextItems = currentForm.curriculumItems.filter(
        (item) => String(item.id) !== String(curriculumId)
      );

      return {
        ...currentForm,
        curriculumItems: nextItems.length > 0 ? nextItems : [createCurriculumDraft()],
      };
    });
  }

  function handleEditMentorCourse(course) {
    setMentorCourseForm({
      title: course.title || '',
      summary: course.summary || '',
      description: course.description || '',
      meetingType: course.meetingType || 'ONLINE',
      price: String(course.price ?? 0),
      capacity: String(course.capacity ?? 1),
      curriculumItems:
        course.curriculumItems?.length > 0
          ? course.curriculumItems.map((item) => ({
              id: item.id,
              title: item.title || '',
              description: item.description || '',
            }))
          : [createCurriculumDraft()],
      status: course.status || 'DRAFT',
    });
    setMentorCourseFormMode('edit');
    setEditingMentorCourseId(course.id);
    setMentorCourseNotice('');
    setMentorCourseError('');
  }

  async function handleMentorCourseSubmit(event) {
    event.preventDefault();

    setMentorCourseStatus('saving');
    setMentorCourseNotice('');
    setMentorCourseError('');

    const payload = {
      title: mentorCourseForm.title.trim(),
      summary: mentorCourseForm.summary.trim(),
      description: mentorCourseForm.description.trim(),
      meetingType: mentorCourseForm.meetingType,
      price: Number(mentorCourseForm.price),
      capacity: Number(mentorCourseForm.capacity),
      curriculumItems: mentorCourseForm.curriculumItems.map((item) => ({
        title: item.title.trim(),
        description: item.description.trim(),
      })),
      status: mentorCourseForm.status,
    };

    try {
      if (mentorCourseFormMode === 'edit' && editingMentorCourseId) {
        await updateMyMentorCourse(editingMentorCourseId, payload);
      } else {
        await createMyMentorCourse(payload);
      }

      await Promise.all([refreshMentorManagementProfile(), refreshMentorProfiles()]);
      if (currentUser?.role === 'ADMIN') {
        await refreshAdminDashboard();
      }
      setMentorCourseStatus('saved');
      setMentorCourseNotice(
        mentorCourseFormMode === 'edit' ? '수업 정보를 수정했습니다.' : '수업을 개설했습니다.'
      );
      setPageNotice(
        mentorCourseFormMode === 'edit' ? '수업 정보를 수정했습니다.' : '수업을 개설했습니다.'
      );
      resetMentorCourseEditor();
    } catch (error) {
      setMentorCourseStatus('error');
      setMentorCourseError(
        error?.response?.data?.message || error.message || '수업 저장에 실패했습니다.'
      );
    }
  }

  async function handleCreateCourseApplication(event, mentor) {
    event.preventDefault();

    if (!selectedCourseId) {
      setCourseApplicationError('신청할 수업을 선택해 주세요.');
      setCourseApplicationNotice('');
      return;
    }

    setCourseApplicationStatus('saving');
    setCourseApplicationNotice('');
    setCourseApplicationError('');

    try {
      await createMentorCourseApplication(selectedCourseId, {
        message: courseApplicationMessage.trim(),
      });
      await Promise.all([refreshCourseApplications(), refreshMentorProfiles()]);
      setCourseApplicationStatus('saved');
      setCourseApplicationNotice(
        `${mentor.nickname} 멘토의 수업 신청을 보냈습니다. 상태는 내 진행에서 확인할 수 있습니다.`
      );
      setPageNotice('수업 신청을 보냈습니다.');
      setCourseApplicationMessage('');
      focusCategory('my_progress');
    } catch (error) {
      setCourseApplicationStatus('error');
      setCourseApplicationError(
        error?.response?.data?.message || error.message || '수업 신청에 실패했습니다.'
      );
    }
  }

  async function handleReceivedCourseApplicationDecision(applicationId, decision) {
    setActiveCourseApplicationId(applicationId);
    setCourseApplicationNotice('');
    setCourseApplicationError('');

    try {
      if (decision === 'approve') {
        await approveMentorCourseApplication(applicationId, {
          reviewNote: courseApplicationReviewNote.trim(),
        });
      } else {
        await rejectMentorCourseApplication(applicationId, {
          reviewNote: courseApplicationReviewNote.trim(),
        });
      }

      await refreshCourseApplications();
      if (currentUser?.role === 'ADMIN') {
        await refreshAdminDashboard();
      }
      setCourseApplicationReviewNote('');
      setCourseApplicationNotice(
        decision === 'approve' ? '수업 신청을 승인했습니다.' : '수업 신청을 반려했습니다.'
      );
      setPageNotice(
        decision === 'approve' ? '수업 신청을 승인했습니다.' : '수업 신청을 반려했습니다.'
      );
      focusCategory('received_course_applications', `received-course-application-${applicationId}`);
    } catch (error) {
      setCourseApplicationError(
        error?.response?.data?.message || error.message || '수업 신청 상태 변경에 실패했습니다.'
      );
    } finally {
      setActiveCourseApplicationId(null);
    }
  }

  async function handleCancelCourseApplication(applicationId) {
    setActiveCourseApplicationId(applicationId);
    setCourseApplicationNotice('');
    setCourseApplicationError('');

    try {
      await cancelMentorCourseApplication(applicationId);
      await refreshCourseApplications();
      setCourseApplicationNotice('수업 신청을 취소했습니다.');
      setPageNotice('수업 신청을 취소했습니다.');
      focusCategory('my_progress');
    } catch (error) {
      setCourseApplicationError(
        error?.response?.data?.message || error.message || '수업 신청 취소에 실패했습니다.'
      );
    } finally {
      setActiveCourseApplicationId(null);
    }
  }

  async function handleCreateReservation(event, mentorId) {
    event.preventDefault();

    if (!mentorId) {
      setReservationCreateError('멘토를 먼저 선택해 주세요.');
      setReservationCreateNotice('');
      return;
    }

    if (!reservationDateTime) {
      setReservationCreateError('예약 날짜와 시간을 선택해 주세요.');
      setReservationCreateNotice('');
      return;
    }

    setReservationCreateStatus('saving');
    setReservationCreateError('');
    setReservationCreateNotice('');

    try {
      await createReservation({
        mentorId: Number(mentorId),
        reservedAt: new Date(reservationDateTime).toISOString(),
        message: reservationCreateMessage.trim(),
      });

      await refreshReservations();
      setReservationCreateMessage('');
      setReservationDateTime(getDefaultReservationDateTime());
      setReservationCreateStatus('saved');
      setReservationCreateNotice('예약을 생성했습니다.');
      setPageNotice('예약 제안을 보냈습니다. 상태는 내 진행에서 계속 확인할 수 있습니다.');
      focusCategory('my_progress');
    } catch (error) {
      setReservationCreateStatus('error');
      setReservationCreateError(
        error?.response?.data?.message || error.message || '예약 생성에 실패했습니다.'
      );
    }
  }

  async function handleAdminMentorVisibility(mentorId, mentorEnabled) {
    setActiveAdminMentorId(mentorId);
    setAdminConsoleNotice('');
    setAdminConsoleError('');

    try {
      await updateAdminMentorVisibility(mentorId, { mentorEnabled });
      await Promise.all([refreshAdminDashboard(), refreshMentorProfiles()]);
      setAdminConsoleNotice(
        mentorEnabled
          ? '멘토를 다시 목록에 노출했습니다.'
          : '멘토를 목록에서 숨김 처리했습니다.'
      );
      setPageNotice(
        mentorEnabled
          ? '멘토 노출 상태를 변경했습니다.'
          : '멘토 비노출 상태를 변경했습니다.'
      );
      focusCategory('admin_console', `admin-mentor-${mentorId}`);
    } catch (error) {
      setAdminConsoleError(
        error?.response?.data?.message || error.message || '멘토 노출 상태 변경에 실패했습니다.'
      );
    } finally {
      setActiveAdminMentorId(null);
    }
  }

  async function handleAdminCourseStatusChange(courseId, status) {
    setActiveAdminCourseId(courseId);
    setAdminConsoleNotice('');
    setAdminConsoleError('');

    try {
      await updateAdminCourseStatus(courseId, { status });
      await Promise.all([refreshAdminDashboard(), refreshMentorProfiles()]);
      if (currentUser?.role === 'ADMIN') {
        await refreshMentorManagementProfile();
      }
      setAdminConsoleNotice('수업 공개 상태를 변경했습니다.');
      setPageNotice('수업 공개 상태를 변경했습니다.');
      focusCategory('admin_console', `admin-course-${courseId}`);
    } catch (error) {
      setAdminConsoleError(
        error?.response?.data?.message || error.message || '수업 상태 변경에 실패했습니다.'
      );
    } finally {
      setActiveAdminCourseId(null);
    }
  }

  async function handleNotificationAction(notification) {
    if (notification.source === 'server' && !notification.isRead) {
      setActiveNotificationId(notification.id);
      setNotificationError('');

      try {
        const updatedNotification = normalizeServerNotification(
          await markNotificationAsRead(notification.id)
        );
        setServerNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            String(currentNotification.id) === String(notification.id)
              ? updatedNotification
              : currentNotification
          )
        );
      } catch (error) {
        setNotificationError(
          error?.response?.data?.message || error.message || '알림 상태를 업데이트하지 못했습니다.'
        );
        setActiveNotificationId(null);
        return;
      }

      setActiveNotificationId(null);
    }

    if (notification.actionType === 'enter_request_session' && notification.request) {
      openMentoringSession(notification.request);
      return;
    }

    if (notification.actionType === 'enter_reservation_session' && notification.reservation) {
      openReservationSession(notification.reservation);
      return;
    }

    if (notification.actionType === 'view_my_reservations') {
      focusCategory('my_progress');
      return;
    }

    if (notification.actionType === 'view_requests') {
      focusCategory('my_progress');
    }
  }

  async function handleDismissNotification(notification) {
    if (notification.source === 'server') {
      if (notification.isRead) {
        return;
      }

      setActiveNotificationId(notification.id);
      setNotificationError('');

      try {
        const updatedNotification = normalizeServerNotification(
          await markNotificationAsRead(notification.id)
        );
        setServerNotifications((currentNotifications) =>
          currentNotifications.map((currentNotification) =>
            String(currentNotification.id) === String(notification.id)
              ? updatedNotification
              : currentNotification
          )
        );
      } catch (error) {
        setNotificationError(
          error?.response?.data?.message || error.message || '알림 상태를 업데이트하지 못했습니다.'
        );
      } finally {
        setActiveNotificationId(null);
      }

      return;
    }

    const nextDismissedIds = dismissLobbyNotification(currentUser?.id, notification.id);
    setDismissedNotificationIds(nextDismissedIds);
  }

  async function handleReadAllNotifications() {
    setIsReadingAllNotifications(true);
    setNotificationError('');

    try {
      const updatedNotifications = normalizeServerNotifications(
        await markAllNotificationsAsRead()
      );
      const updatedNotificationMap = new Map(
        updatedNotifications.map((notification) => [String(notification.id), notification])
      );

      setServerNotifications((currentNotifications) =>
        currentNotifications.map(
          (notification) => updatedNotificationMap.get(String(notification.id)) || notification
        )
      );
      setPageNotice('모든 알림을 읽음 처리했습니다.');
    } catch (error) {
      setNotificationError(
        error?.response?.data?.message || error.message || '알림 전체 읽음 처리에 실패했습니다.'
      );
    } finally {
      setIsReadingAllNotifications(false);
    }
  }

  async function handleFeedbackSubmit(event) {
    event.preventDefault();

    if (!feedbackPrompt?.requestId) {
      return;
    }

    setFeedbackStatus('saving');
    setFeedbackNotice('');
    setFeedbackError('');

    try {
      const savedFeedback = normalizeServerFeedback(
        await createSessionFeedback(
          feedbackPrompt.sessionSource === 'reservation'
            ? {
                sessionSource: 'reservation',
                reservationId: Number(feedbackPrompt.requestId),
                rating: Number(feedbackRating),
                summary: feedbackSummary.trim(),
                feedback: feedbackMessage.trim(),
              }
            : {
                requestId: Number(feedbackPrompt.requestId),
                rating: Number(feedbackRating),
                summary: feedbackSummary.trim(),
                feedback: feedbackMessage.trim(),
              }
        )
      );

      setFeedbackRating(String(savedFeedback?.rating || 5));
      setFeedbackSummary(savedFeedback?.summary || '');
      setFeedbackMessage(savedFeedback?.feedback || '');
      setFeedbackStatus('saved');
      setFeedbackNotice(
        `${formatFeedbackTimestamp(savedFeedback?.submittedAt)}에 피드백을 저장했습니다.`
      );
      setPageNotice('세션 피드백을 저장했습니다.');
      await refreshFeedbackHistory(currentUser?.id);
    } catch (error) {
      setFeedbackStatus('error');
      setFeedbackError(
        error?.response?.data?.message || error.message || '세션 피드백 저장에 실패했습니다.'
      );
    }
  }

  function handleDismissFeedback() {
    setFeedbackPrompt(null);
    setFeedbackNotice('');
    setFeedbackError('');
    setFeedbackStatus('idle');
  }

  useEffect(() => {
    let isMounted = true;

    async function loadActivityData() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const meResponse = await getMe();

        const [
          spacesResponse,
          mentorsResponse,
          sentRequestsResponse,
          receivedRequestsResponse,
          myReservationsResponse,
          receivedReservationsResponse,
          myFeedbacksResponse,
          myNotificationsResponse,
          myMentorApplicationResponse,
          pendingMentorApplicationsResponse,
          adminDashboardResponse,
          myMentorManagementProfileResponse,
          myCourseApplicationsResponse,
          receivedCourseApplicationsResponse,
        ] = await Promise.all([
          getSpaces(),
          getMentors(),
          getSentMentoringRequests(),
          getReceivedMentoringRequests(),
          getMyReservations(),
          getReceivedReservations(),
          getMySessionFeedbacks(),
          getNotifications(),
          meResponse.role === 'USER'
            ? getMyMentorApplication().catch((error) =>
                error?.response?.status === 404 ? null : Promise.reject(error)
              )
            : Promise.resolve(null),
          meResponse.role === 'ADMIN' ? getPendingMentorApplications() : Promise.resolve([]),
          meResponse.role === 'ADMIN' ? getAdminDashboard() : Promise.resolve(null),
          meResponse.role === 'MENTOR' || meResponse.role === 'ADMIN'
            ? getMyMentorProfile()
            : Promise.resolve(null),
          getMyMentorCourseApplications(),
          meResponse.role === 'MENTOR' || meResponse.role === 'ADMIN'
            ? getReceivedMentorCourseApplications()
            : Promise.resolve([]),
        ]);

        if (!isMounted) {
          return;
        }

        setCurrentUser(meResponse);
        setSpaces(Array.isArray(spacesResponse) ? spacesResponse : []);
        setMentorProfiles(normalizeMentorProfiles(mentorsResponse));
        setSentRequests(normalizeSentRequests(sentRequestsResponse));
        setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
        setReservations(normalizeReservations(myReservationsResponse));
        setReceivedReservations(normalizeReservations(receivedReservationsResponse));
        setFeedbackHistory(sortFeedbackHistory(normalizeFeedbackHistory(myFeedbacksResponse)));
        setServerNotifications(normalizeServerNotifications(myNotificationsResponse));
        setMentorApplication(myMentorApplicationResponse);
        setPendingMentorApplications(pendingMentorApplicationsResponse);
        setAdminDashboard(normalizeAdminDashboard(adminDashboardResponse));
        syncMentorManagementState(myMentorManagementProfileResponse);
        setMyCourseApplications(normalizeMentorCourseApplications(myCourseApplicationsResponse));
        setReceivedCourseApplications(
          normalizeMentorCourseApplications(receivedCourseApplicationsResponse)
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const status = error?.response?.status;
        const message =
          error?.response?.data?.message || error.message || '내 활동 정보를 불러오지 못했습니다.';

        if (status === 401) {
          clearAuth();
          navigate('/login', { replace: true });
          return;
        }

        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadActivityData();

    return () => {
      isMounted = false;
    };
  }, [clearAuth, navigate, setCurrentUser]);

  useEffect(() => {
    setDismissedNotificationIds(getDismissedLobbyNotificationIds(currentUser?.id));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!mentorApplication || mentorApplication.status !== 'REJECTED') {
      return;
    }

    setMentorApplicationBio(mentorApplication.bio || '');
    setMentorApplicationSpecialties(mentorApplication.specialties || '');
    setMentorApplicationInterests(mentorApplication.interests || '');
    setMentorApplicationReason(mentorApplication.reason || '');
  }, [mentorApplication]);

  useEffect(() => {
    if (!currentUser?.id) {
      syncMentorManagementState(null);
      return;
    }

    if (currentUser.role === 'MENTOR' || currentUser.role === 'ADMIN') {
      refreshMentorManagementProfile().catch(() => {});
      return;
    }

    syncMentorManagementState(null);
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setReservationClock(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isLoading || errorMessage || !currentUser?.id) {
      return undefined;
    }

    let isCancelled = false;

    const syncActivityState = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      try {
        const [
          meResponse,
          sentRequestsResponse,
          receivedRequestsResponse,
          myReservationsResponse,
          receivedReservationsResponse,
          myNotificationsResponse,
          myMentorApplicationResponse,
          pendingMentorApplicationsResponse,
          adminDashboardResponse,
          myCourseApplicationsResponse,
          receivedCourseApplicationsResponse,
        ] = await Promise.all([
          getMe(),
          getSentMentoringRequests(),
          getReceivedMentoringRequests(),
          getMyReservations(),
          getReceivedReservations(),
          getNotifications(),
          currentUser?.role === 'USER'
            ? getMyMentorApplication().catch((error) =>
                error?.response?.status === 404 ? null : Promise.reject(error)
              )
            : Promise.resolve(null),
          currentUser?.role === 'ADMIN' ? getPendingMentorApplications() : Promise.resolve([]),
          currentUser?.role === 'ADMIN' ? getAdminDashboard() : Promise.resolve(null),
          getMyMentorCourseApplications(),
          currentUser?.role === 'MENTOR' || currentUser?.role === 'ADMIN'
            ? getReceivedMentorCourseApplications()
            : Promise.resolve([]),
        ]);

        if (isCancelled) {
          return;
        }

        setCurrentUser(meResponse);
        setSentRequests(normalizeSentRequests(sentRequestsResponse));
        setReceivedRequests(normalizeReceivedRequests(receivedRequestsResponse));
        setReservations(normalizeReservations(myReservationsResponse));
        setReceivedReservations(normalizeReservations(receivedReservationsResponse));
        setServerNotifications(normalizeServerNotifications(myNotificationsResponse));
        setMentorApplication(myMentorApplicationResponse);
        setPendingMentorApplications(pendingMentorApplicationsResponse);
        setAdminDashboard(normalizeAdminDashboard(adminDashboardResponse));
        setMyCourseApplications(normalizeMentorCourseApplications(myCourseApplicationsResponse));
        setReceivedCourseApplications(
          normalizeMentorCourseApplications(receivedCourseApplicationsResponse)
        );
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (error?.response?.status === 401) {
          clearAuth();
          navigate('/login', { replace: true });
        }
      }
    };

    const intervalId = window.setInterval(syncActivityState, 7000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [clearAuth, currentUser?.id, currentUser?.role, errorMessage, isLoading, navigate]);

  useEffect(() => {
    const nextNotice = location.state?.sessionMessage || location.state?.message;
    const nextFeedbackPrompt = normalizeFeedbackPrompt(location.state?.feedbackPrompt);

    if (!nextNotice && !nextFeedbackPrompt) {
      return;
    }

    if (nextNotice) {
      setPageNotice(nextNotice);
    }

    if (nextFeedbackPrompt) {
      setFeedbackPrompt(nextFeedbackPrompt);
      setActiveCategory('feedback');
      setSelectedItemId(`feedback-prompt-${nextFeedbackPrompt.requestId}`);
    }

    navigate('/hub', {
      replace: true,
      state: null,
    });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!feedbackPrompt?.requestId) {
      return;
    }

    let isMounted = true;

    async function loadExistingFeedback() {
      setFeedbackRating('5');
      setFeedbackSummary('');
      setFeedbackMessage('');
      setFeedbackStatus('idle');
      setFeedbackNotice('');
      setFeedbackError('');

      try {
        const existingFeedback = normalizeServerFeedback(
          feedbackPrompt.sessionSource === 'reservation'
            ? await getSessionFeedbackByReservationId(feedbackPrompt.requestId)
            : await getSessionFeedbackByRequestId(feedbackPrompt.requestId)
        );

        if (!existingFeedback || !isMounted) {
          return;
        }

        setFeedbackRating(String(existingFeedback.rating || 5));
        setFeedbackSummary(existingFeedback.summary || '');
        setFeedbackMessage(existingFeedback.feedback || '');
        setFeedbackStatus('saved');
        setFeedbackNotice(
          `${formatFeedbackTimestamp(existingFeedback.submittedAt)}에 이미 저장된 피드백입니다.`
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error?.response?.status !== 404) {
          setFeedbackError(
            error?.response?.data?.message ||
              error.message ||
              '기존 세션 피드백을 불러오지 못했습니다.'
          );
        }
      }
    }

    loadExistingFeedback();

    return () => {
      isMounted = false;
    };
  }, [feedbackPrompt]);

  useEffect(() => {
    if (feedbackPrompt) {
      setActiveCategory('feedback');
      setSelectedItemId(`feedback-prompt-${feedbackPrompt.requestId}`);
    }
  }, [feedbackPrompt]);

  useEffect(() => {
    const hasCurrentCategoryItems = categoryItems[activeCategory]?.length > 0;

    if (!hasCurrentCategoryItems && categoryItems[recommendedCategory]?.length > 0) {
      setActiveCategory(recommendedCategory);
    }
  }, [activeCategory, categoryItems, recommendedCategory]);

  useEffect(() => {
      if (!categoryDefinitions.some((category) => category.id === activeCategory)) {
      setActiveCategory(recommendedCategory);
    }
  }, [activeCategory, categoryDefinitions, recommendedCategory]);

  useEffect(() => {
    setMentoringFeedback('');
    setMentoringError('');
    setReservationCreateNotice('');
    setReservationCreateError('');
    setCourseApplicationNotice('');
    setCourseApplicationError('');
    setCourseApplicationReviewNote('');
  }, [selectedItemId]);

  useEffect(() => {
    const nextItems = categoryItems[activeCategory] || [];

    if (nextItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    if (!nextItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(nextItems[0].id);
    }
  }, [activeCategory, categoryItems, selectedItemId]);

  useEffect(() => {
    if (selectedItem?.kind !== 'mentor_profile') {
      return;
    }

    const firstCourseId = selectedItem.raw?.courses?.[0]?.id;

    if (firstCourseId) {
      setSelectedCourseId(String(firstCourseId));
      return;
    }

    setSelectedCourseId('');
  }, [selectedItem]);

  function renderSidebarEmpty() {
    if (activeCategory === 'find_mentors' && hasActiveMentorFilters) {
      return (
        <div className="activity-list__empty">
          <strong>조건에 맞는 멘토가 없습니다.</strong>
          <p>검색어를 줄이거나 요일, 수업 방식, 가격 조건을 완화해 보세요.</p>
        </div>
      );
    }

    const emptyCopy = getCategoryEmptyCopy(activeCategory);

    return (
      <div className="activity-list__empty">
        <strong>{emptyCopy.title}</strong>
        <p>{emptyCopy.description}</p>
      </div>
    );
  }

  function renderEmptyDetail() {
    if (activeCategory === 'find_mentors' && hasActiveMentorFilters) {
      return (
        <section className="activity-detail__placeholder">
          <span className="activity-detail__eyebrow">멘토 찾기</span>
          <h2>조건에 맞는 멘토가 없습니다</h2>
          <p>검색어, 가능 요일, 수업 방식, 가격 필터를 조정하면 다른 멘토를 찾을 수 있습니다.</p>
          <div className="activity-detail__actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setMentorFilters(DEFAULT_MENTOR_FILTERS)}
            >
              필터 초기화
            </button>
            <button type="button" className="secondary-button" onClick={handleEnterMetaverse}>
              메타버스 입장
            </button>
          </div>
        </section>
      );
    }

    const emptyCopy = getCategoryEmptyCopy(activeCategory);

    return (
      <section className="activity-detail__placeholder">
        <span className="activity-detail__eyebrow">내 활동</span>
        <h2>{emptyCopy.title}</h2>
        <p>{emptyCopy.description}</p>
        <div className="activity-detail__actions">
          <button type="button" className="primary-button" onClick={handleEnterMetaverse}>
            메타버스 입장
          </button>
          <button type="button" className="secondary-button" onClick={() => navigate('/lobby')}>
            로비로 돌아가기
          </button>
        </div>
      </section>
    );
  }

  function renderDetailFrame({ eyebrow, title, badge, tone, meta, actions, children, asideAction }) {
    return (
      <section className="activity-detail__card">
        <header className="activity-detail__header">
          <div>
            <span className="activity-detail__eyebrow">{eyebrow}</span>
            <div className="activity-detail__title-row">
              <h2>{title}</h2>
              {badge ? (
                <span className={`activity-badge activity-badge--${tone || 'info'}`}>{badge}</span>
              ) : null}
            </div>
            {meta ? <p className="activity-detail__meta">{meta}</p> : null}
          </div>
          {asideAction || null}
        </header>

        <div className="activity-detail__body">{children}</div>

        {actions ? <div className="activity-detail__actions">{actions}</div> : null}
      </section>
    );
  }

  function renderMentorFilterPanel() {
    if (activeCategory !== 'find_mentors') {
      return null;
    }

    return (
      <section className="mentor-filter-panel">
        <label className="app-field mentor-filter-panel__field">
          <span>검색어</span>
          <input
            className="app-input"
            value={mentorFilters.keyword}
            onChange={(event) =>
              setMentorFilters((currentFilters) => ({
                ...currentFilters,
                keyword: event.target.value,
              }))
            }
            placeholder="멘토 이름, 전문 분야, 수업명으로 검색"
          />
        </label>
        <div className="mentor-filter-panel__grid">
          <label className="app-field mentor-filter-panel__field">
            <span>가능 요일</span>
            <select
              className="app-input"
              value={mentorFilters.dayOfWeek}
              onChange={(event) =>
                setMentorFilters((currentFilters) => ({
                  ...currentFilters,
                  dayOfWeek: event.target.value,
                }))
              }
            >
              <option value="ALL">전체</option>
              {Object.entries(DAY_OF_WEEK_LABELS).map(([dayKey, dayLabel]) => (
                <option key={dayKey} value={dayKey}>
                  {dayLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="app-field mentor-filter-panel__field">
            <span>수업 방식</span>
            <select
              className="app-input"
              value={mentorFilters.meetingType}
              onChange={(event) =>
                setMentorFilters((currentFilters) => ({
                  ...currentFilters,
                  meetingType: event.target.value,
                }))
              }
            >
              <option value="ALL">전체</option>
              <option value="ONLINE">온라인</option>
              <option value="OFFLINE">오프라인</option>
              <option value="HYBRID">온오프라인</option>
            </select>
          </label>
          <label className="app-field mentor-filter-panel__field">
            <span>최대 가격</span>
            <select
              className="app-input"
              value={mentorFilters.maxPrice}
              onChange={(event) =>
                setMentorFilters((currentFilters) => ({
                  ...currentFilters,
                  maxPrice: event.target.value,
                }))
              }
            >
              <option value="ALL">전체</option>
              <option value="0">무료</option>
              <option value="10000">1만원 이하</option>
              <option value="30000">3만원 이하</option>
              <option value="50000">5만원 이하</option>
            </select>
          </label>
          <label className="app-field mentor-filter-panel__field">
            <span>정렬</span>
            <select
              className="app-input"
              value={mentorFilters.sort}
              onChange={(event) =>
                setMentorFilters((currentFilters) => ({
                  ...currentFilters,
                  sort: event.target.value,
                }))
              }
            >
              <option value="recommended">이름순</option>
              <option value="price_low">가격 낮은 순</option>
              <option value="course_count">수업 많은 순</option>
              <option value="availability">가능 시간 많은 순</option>
            </select>
          </label>
        </div>
        <div className="mentor-filter-panel__footer">
          <small>{filteredAvailableMentors.length}명의 멘토가 조건에 맞습니다.</small>
          {hasActiveMentorFilters ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setMentorFilters(DEFAULT_MENTOR_FILTERS)}
            >
              필터 초기화
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  function renderReceivedRequestDetail(request) {
    const isPending = request.status === 'PENDING';
    const isProcessing = activeRequestActionId === request.id;

    return renderDetailFrame({
      eyebrow: '받은 요청',
      title: request.requesterLabel,
      badge: formatRequestStatus(request.status),
      tone: getStatusTone(request.status),
      meta: request.createdAt ? formatDateTime(request.createdAt) : '도착 시간 정보 없음',
      actions:
        isPending || request.status === 'ACCEPTED' ? (
          <>
            {isPending ? (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleMentoringDecision(request.id, 'accept')}
                  disabled={isProcessing}
                >
                  {isProcessing ? '처리 중...' : '수락'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleMentoringDecision(request.id, 'reject')}
                  disabled={isProcessing}
                >
                  거절
                </button>
              </>
            ) : null}
            {request.status === 'ACCEPTED' ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => openMentoringSession(request)}
              >
                세션 입장
              </button>
            ) : null}
          </>
        ) : null,
      children: (
        <>
          {requestActionError ? <p className="app-error">{requestActionError}</p> : null}
          <section className="activity-detail__section">
            <h3>보낸 메시지</h3>
            <p>{request.message || '메시지가 없습니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>다음 흐름</h3>
            <p>
              요청을 수락하면 바로 멘토링 세션으로 이어집니다. 보류 중이면 여기서 상태를 바로 결정할 수 있습니다.
            </p>
          </section>
        </>
      ),
    });
  }

  function renderReceivedReservationDetail(reservation) {
    const reservationEntryState = getReservationEntryState(
      reservation,
      reservationClock
    );
    const accessCopy = getReservationAccessCopy(
      reservation,
      reservationEntryState,
      'received'
    );
    const isPending = reservation.status === 'PENDING';
    const canEnterReservation =
      reservation.status === 'ACCEPTED' && reservationEntryState.canEnter;
    const isProcessing = activeReceivedReservationActionId === reservation.id;

    return renderDetailFrame({
      eyebrow: '받은 예약',
      title: reservation.requesterLabel || '알 수 없는 요청자',
      badge: formatReservationStatus(reservation.status),
      tone: getStatusTone(reservation.status),
      meta: formatReservationTimestamp(reservation.reservedAt),
      actions:
        isPending || canEnterReservation ? (
          <>
            {canEnterReservation ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => openReservationSession(reservation)}
              >
                세션 입장
              </button>
            ) : null}
            {isPending ? (
              <>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handleReceivedReservationDecision(reservation.id, 'accept')}
                  disabled={isProcessing}
                >
                  {isProcessing ? '처리 중...' : '수락'}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleReceivedReservationDecision(reservation.id, 'reject')}
                  disabled={isProcessing}
                >
                  거절
                </button>
              </>
            ) : null}
          </>
        ) : null,
      children: (
        <>
          {receivedReservationNotice ? <p className="app-success">{receivedReservationNotice}</p> : null}
          {receivedReservationError ? <p className="app-error">{receivedReservationError}</p> : null}
          <section className="activity-detail__section">
            <h3>예약 메시지</h3>
            <p>{reservation.message || '예약 메시지가 없습니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>입장 상태</h3>
            <p>{accessCopy.headline}</p>
            <p>{accessCopy.detail}</p>
            {reservation.status === 'ACCEPTED' ? (
              <>
                <p>{formatReservationEntryStatusLabel(reservationEntryState)}</p>
                <p>{formatReservationEntryWindow(reservationEntryState)}</p>
              </>
            ) : null}
          </section>
        </>
      ),
    });
  }

  function renderSentRequestDetail(request) {
    return renderDetailFrame({
      eyebrow: '내 진행',
      title: request.mentorLabel,
      badge: formatRequestStatus(request.status),
      tone: getStatusTone(request.status),
      meta: request.createdAt ? formatDateTime(request.createdAt) : '보낸 시각 정보 없음',
      actions:
        request.status === 'ACCEPTED' ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => openMentoringSession(request)}
          >
            세션 입장
          </button>
        ) : null,
      children: (
        <>
          <section className="activity-detail__section">
            <h3>보낸 메시지</h3>
            <p>{request.message || '메시지가 없습니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>현재 상태</h3>
            <p>
              {request.status === 'PENDING'
                ? '상대가 요청을 확인하는 중입니다.'
                : request.status === 'ACCEPTED'
                  ? '요청이 수락되어 바로 세션에 입장할 수 있습니다.'
                  : '이 요청은 더 이상 진행되지 않습니다.'}
            </p>
          </section>
        </>
      ),
    });
  }

  function renderSentReservationDetail(reservation) {
    const reservationEntryState = getReservationEntryState(
      reservation,
      reservationClock
    );
    const accessCopy = getReservationAccessCopy(
      reservation,
      reservationEntryState,
      'sent'
    );
    const canEnterReservation =
      reservation.status === 'ACCEPTED' && reservationEntryState.canEnter;
    const isCancelable =
      reservation.status === 'PENDING' ||
      (reservation.status === 'ACCEPTED' && reservationEntryState.status !== 'expired');
    const isProcessing = activeReservationActionId === reservation.id;

    return renderDetailFrame({
      eyebrow: '내 진행',
      title: reservation.mentorLabel,
      badge: formatReservationStatus(reservation.status),
      tone: getStatusTone(reservation.status),
      meta: formatReservationTimestamp(reservation.reservedAt),
      actions:
        isCancelable || canEnterReservation ? (
          <>
            {canEnterReservation ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => openReservationSession(reservation)}
              >
                세션 입장
              </button>
            ) : null}
            {isCancelable ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleReservationCancel(reservation.id)}
                disabled={isProcessing}
              >
                {isProcessing ? '취소 중...' : '예약 취소'}
              </button>
            ) : null}
          </>
        ) : null,
      children: (
        <>
          {reservationError ? <p className="app-error">{reservationError}</p> : null}
          <section className="activity-detail__section">
            <h3>예약 메시지</h3>
            <p>{reservation.message || '예약 메시지가 없습니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>입장 상태</h3>
            <p>{accessCopy.headline}</p>
            <p>{accessCopy.detail}</p>
            {reservation.status === 'ACCEPTED' ? (
              <>
                <p>{formatReservationEntryStatusLabel(reservationEntryState)}</p>
                <p>{formatReservationEntryWindow(reservationEntryState)}</p>
              </>
            ) : null}
          </section>
        </>
      ),
    });
  }

  function renderNotificationDetail(notification) {
    return renderDetailFrame({
      eyebrow: '알림',
      title: notification.title,
      badge: formatNotificationTypeLabel(notification.type),
      tone: notification.type === 'reservation_ready' ? 'accepted' : 'info',
      meta: notification.createdAt ? formatDateTime(notification.createdAt) : '새 알림',
      asideAction:
        hasUnreadServerNotifications && activeCategory === 'notifications' ? (
          <button
            type="button"
            className="secondary-button"
            onClick={handleReadAllNotifications}
            disabled={isReadingAllNotifications}
          >
            {isReadingAllNotifications ? '읽음 처리 중...' : '모두 읽음'}
          </button>
        ) : null,
      actions: (
        <>
          <button
            type="button"
            className="primary-button"
            onClick={() => handleNotificationAction(notification)}
            disabled={activeNotificationId === notification.id}
          >
            {activeNotificationId === notification.id ? '처리 중...' : notification.actionLabel}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => handleDismissNotification(notification)}
            disabled={activeNotificationId === notification.id}
          >
            {notification.source === 'server' ? '읽음 처리' : '닫기'}
          </button>
        </>
      ),
      children: (
        <>
          {notificationError ? <p className="app-error">{notificationError}</p> : null}
          <section className="activity-detail__section">
            <h3>내용</h3>
            <p>{notification.message}</p>
          </section>
          <section className="activity-detail__section">
            <h3>다음 행동</h3>
            <p>
              요청이나 예약 상태가 바뀌면 여기서 바로 확인하고, 필요한 경우 즉시 세션으로 이어갈 수 있습니다.
            </p>
          </section>
        </>
      ),
    });
  }

  function renderFeedbackPromptDetail(prompt) {
    return renderDetailFrame({
      eyebrow: '세션 기록',
      title: `${prompt.counterpartName} 세션 피드백`,
      badge: feedbackStatus === 'saved' ? '저장됨' : '작성 필요',
      tone: feedbackStatus === 'saved' ? 'accepted' : 'pending',
      meta: prompt.reservedAt
        ? formatReservationTimestamp(prompt.reservedAt)
        : formatSessionSourceLabel(prompt.sessionSource),
      actions: (
        <>
          <button type="submit" form="activity-feedback-form" className="primary-button" disabled={isFeedbackLocked}>
            {feedbackStatus === 'saving'
              ? '저장 중...'
              : feedbackStatus === 'saved'
                ? '저장 완료'
                : '피드백 저장'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDismissFeedback}
            disabled={feedbackStatus === 'saving'}
          >
            닫기
          </button>
        </>
      ),
      children: (
        <>
          {feedbackNotice ? <p className="app-success">{feedbackNotice}</p> : null}
          {feedbackError ? <p className="app-error">{feedbackError}</p> : null}
          <section className="activity-detail__section">
            <h3>세션 정보</h3>
            <p>유형: {formatSessionSourceLabel(prompt.sessionSource)}</p>
            <p>내 역할: {formatParticipantRole(prompt.role)}</p>
            {prompt.requestMessage ? <p>요청 요약: {prompt.requestMessage}</p> : null}
          </section>

          <form id="activity-feedback-form" className="mentoring-form" onSubmit={handleFeedbackSubmit}>
            <label className="app-field">
              <span>평점</span>
              <select
                className="app-input"
                value={feedbackRating}
                onChange={(event) => setFeedbackRating(event.target.value)}
                disabled={isFeedbackLocked}
              >
                <option value="5">5 - 매우 만족</option>
                <option value="4">4 - 만족</option>
                <option value="3">3 - 보통</option>
                <option value="2">2 - 아쉬움</option>
                <option value="1">1 - 불만족</option>
              </select>
            </label>

            <label className="app-field">
              <span>세션 요약</span>
              <textarea
                className="app-input mentoring-textarea"
                value={feedbackSummary}
                onChange={(event) => setFeedbackSummary(event.target.value)}
                rows={2}
                placeholder="이번 세션에서 다룬 내용을 짧게 정리해 주세요."
                disabled={isFeedbackLocked}
              />
            </label>

            <label className="app-field">
              <span>피드백</span>
              <textarea
                className="app-input mentoring-textarea"
                value={feedbackMessage}
                onChange={(event) => setFeedbackMessage(event.target.value)}
                rows={4}
                placeholder="세션이 어땠는지 짧은 후기를 남겨 주세요."
                disabled={isFeedbackLocked}
              />
            </label>
          </form>
        </>
      ),
    });
  }

  function renderFeedbackHistoryDetail(feedbackItem) {
    return renderDetailFrame({
      eyebrow: '세션 기록',
      title: feedbackItem.counterpartName || '세션 상대',
      badge: `${feedbackItem.rating || 0}/5`,
      tone: 'info',
      meta: formatFeedbackTimestamp(feedbackItem.submittedAt),
      children: (
        <>
          <section className="activity-detail__section">
            <h3>세션 정보</h3>
            <p>{formatSessionSourceLabel(feedbackItem.sessionSource)}</p>
            <p>{formatHistorySessionLabel(feedbackItem)}</p>
            {feedbackItem.reservedAt ? (
              <p>예약 시간: {formatReservationTimestamp(feedbackItem.reservedAt)}</p>
            ) : null}
          </section>
          <section className="activity-detail__section">
            <h3>세션 요약</h3>
            <p>{feedbackItem.summary || '저장된 세션 요약이 없습니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>남긴 피드백</h3>
            <p>{feedbackItem.feedback || '저장된 피드백이 없습니다.'}</p>
          </section>
        </>
      ),
    });
  }

  function renderMyMentorApplicationDetail(application) {
    const isPending = application?.status === 'PENDING';
    const isApproved = application?.status === 'APPROVED';
    const isRejected = application?.status === 'REJECTED';
    const canSubmit = !application || isRejected;

    return renderDetailFrame({
      eyebrow: '멘토 신청',
      title: application ? '내 멘토 신청 현황' : '멘토 신청하기',
      badge: formatMentorApplicationStatus(application?.status),
      tone: isApproved ? 'accepted' : isRejected ? 'muted' : 'pending',
      meta: application?.createdAt ? formatDateTime(application.createdAt) : '신청 전',
      actions: canSubmit ? (
        <button
          type="submit"
          form="mentor-application-form"
          className="primary-button"
          disabled={mentorApplicationStatus === 'saving'}
        >
          {mentorApplicationStatus === 'saving' ? '제출 중...' : '멘토 신청 제출'}
        </button>
      ) : null,
      children: (
        <>
          {mentorApplicationNotice ? <p className="app-success">{mentorApplicationNotice}</p> : null}
          {mentorApplicationError ? <p className="app-error">{mentorApplicationError}</p> : null}
          <section className="activity-detail__section">
            <h3>현재 상태</h3>
            <p>
              {isApproved
                ? '승인이 완료되었습니다. 새로고침 후 멘토 권한과 멘토 목록 노출이 반영됩니다.'
                : isPending
                  ? '관리자가 신청서를 검토 중입니다. 승인 전까지는 일반 사용자 계정으로 유지됩니다.'
                  : isRejected
                    ? '이전 신청이 반려되었습니다. 내용을 보완해서 다시 제출할 수 있습니다.'
                    : '소개, 전문 분야, 신청 사유를 제출하면 관리자 검토 후 멘토 권한이 열립니다.'}
            </p>
            {application?.reviewNote ? <p>검토 메모: {application.reviewNote}</p> : null}
          </section>

          {application ? (
            <section className="activity-detail__section">
              <h3>제출한 내용</h3>
              <p>전문 분야: {application.specialties}</p>
              <p>관심사: {application.interests}</p>
              <p>소개: {application.bio}</p>
              <p>신청 사유: {application.reason}</p>
            </section>
          ) : null}

          {canSubmit ? (
            <form
              id="mentor-application-form"
              className="mentoring-form"
              onSubmit={handleMentorApplicationSubmit}
            >
              <label className="app-field">
                <span>소개</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorApplicationBio}
                  onChange={(event) => setMentorApplicationBio(event.target.value)}
                  rows={3}
                  placeholder="멘토로 어떤 도움을 줄 수 있는지 소개해 주세요."
                  disabled={mentorApplicationStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>전문 분야</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorApplicationSpecialties}
                  onChange={(event) => setMentorApplicationSpecialties(event.target.value)}
                  rows={2}
                  placeholder="예: Spring Boot, React, 포트폴리오 리뷰"
                  disabled={mentorApplicationStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>관심사</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorApplicationInterests}
                  onChange={(event) => setMentorApplicationInterests(event.target.value)}
                  rows={2}
                  placeholder="예: 백엔드 설계, 인터뷰 준비, 커리어 상담"
                  disabled={mentorApplicationStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>신청 사유</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorApplicationReason}
                  onChange={(event) => setMentorApplicationReason(event.target.value)}
                  rows={4}
                  placeholder="왜 멘토로 활동하고 싶은지 적어 주세요."
                  disabled={mentorApplicationStatus === 'saving'}
                />
              </label>
            </form>
          ) : null}
        </>
      ),
    });
  }

  function renderMentorApplicationReviewDetail(application) {
    const isProcessing = activeMentorApplicationId === application.id;

    return renderDetailFrame({
      eyebrow: '멘토 지원',
      title: application.nickname,
      badge: formatMentorApplicationStatus(application.status),
      tone: application.status === 'PENDING' ? 'pending' : 'info',
      meta: application.createdAt ? formatDateTime(application.createdAt) : '지원 시각 없음',
      actions:
        application.status === 'PENDING' ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => handleMentorApplicationReview(application.id, 'approve')}
              disabled={isProcessing}
            >
              {isProcessing ? '처리 중...' : '승인'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleMentorApplicationReview(application.id, 'reject')}
              disabled={isProcessing}
            >
              반려
            </button>
          </>
        ) : null,
      children: (
        <>
          {mentorApplicationNotice ? <p className="app-success">{mentorApplicationNotice}</p> : null}
          {mentorApplicationError ? <p className="app-error">{mentorApplicationError}</p> : null}
          <section className="activity-detail__section">
            <h3>지원자 정보</h3>
            <p>이메일: {application.email}</p>
            <p>전문 분야: {application.specialties}</p>
            <p>관심사: {application.interests}</p>
          </section>
          <section className="activity-detail__section">
            <h3>자기 소개</h3>
            <p>{application.bio}</p>
          </section>
          <section className="activity-detail__section">
            <h3>신청 사유</h3>
            <p>{application.reason}</p>
          </section>
          <section className="activity-detail__section">
            <h3>검토 메모</h3>
            <textarea
              className="app-input mentoring-textarea"
              value={mentorApplicationReviewNote}
              onChange={(event) => setMentorApplicationReviewNote(event.target.value)}
              rows={3}
              placeholder="승인 또는 반려 사유를 남길 수 있습니다."
              disabled={isProcessing}
            />
          </section>
        </>
      ),
    });
  }

  function renderAdminDashboardDetail(dashboard) {
    const resolvedDashboard = dashboard || adminDashboard;

    return renderDetailFrame({
      eyebrow: '운영 콘솔',
      title: '관리자 대시보드',
      badge: '관리자',
      tone: 'info',
      meta: '멘토, 수업, 신청 흐름을 한 화면에서 운영합니다.',
      children: (
        <>
          {adminConsoleNotice ? <p className="app-success">{adminConsoleNotice}</p> : null}
          {adminConsoleError ? <p className="app-error">{adminConsoleError}</p> : null}
          <section className="activity-detail__section">
            <h3>운영 요약</h3>
            <div className="mentor-course-list">
              <article className="mentor-course-card">
                <strong>멘토 운영</strong>
                <p>전체 멘토 {resolvedDashboard?.mentorCount ?? 0}명</p>
                <p>현재 노출 {resolvedDashboard?.visibleMentorCount ?? 0}명</p>
              </article>
              <article className="mentor-course-card">
                <strong>수업 운영</strong>
                <p>공개 수업 {resolvedDashboard?.publishedCourseCount ?? 0}개</p>
                <p>대기 수업 신청 {resolvedDashboard?.pendingCourseApplicationCount ?? 0}건</p>
              </article>
              <article className="mentor-course-card">
                <strong>승인 대기</strong>
                <p>멘토 지원 {resolvedDashboard?.pendingMentorApplicationCount ?? 0}건</p>
                <p>왼쪽 목록에서 멘토와 수업 상태를 바로 운영할 수 있습니다.</p>
              </article>
            </div>
          </section>

          <section className="activity-detail__section">
            <h3>운영 범위</h3>
            <p>멘토 지원 승인은 `멘토 지원` 카테고리에서 처리합니다.</p>
            <p>운영 콘솔에서는 멘토 노출 여부와 수업 공개 상태를 제어합니다.</p>
          </section>
        </>
      ),
    });
  }

  function renderAdminMentorDetail(mentor) {
    const isProcessing = activeAdminMentorId === mentor.id;

    return renderDetailFrame({
      eyebrow: '운영 콘솔',
      title: mentor.nickname,
      badge: mentor.mentorEnabled ? '노출 중' : '비노출',
      tone: mentor.mentorEnabled ? 'accepted' : 'muted',
      meta: mentor.email,
      actions: (
        <button
          type="button"
          className={mentor.mentorEnabled ? 'secondary-button' : 'primary-button'}
          onClick={() => handleAdminMentorVisibility(mentor.id, !mentor.mentorEnabled)}
          disabled={isProcessing}
        >
          {isProcessing
            ? '처리 중...'
            : mentor.mentorEnabled
              ? '비노출 전환'
              : '다시 노출'}
        </button>
      ),
      children: (
        <>
          {adminConsoleNotice ? <p className="app-success">{adminConsoleNotice}</p> : null}
          {adminConsoleError ? <p className="app-error">{adminConsoleError}</p> : null}
          <section className="activity-detail__section">
            <h3>멘토 상태</h3>
            <p>이메일: {mentor.email}</p>
            <p>전문 분야: {mentor.specialties || '등록된 전문 분야가 없습니다.'}</p>
            <p>공개 상태: {mentor.mentorEnabled ? '멘토 목록에 노출 중입니다.' : '멘토 목록에서 숨김 상태입니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>운영 지표</h3>
            <p>전체 수업 수: {mentor.courseCount}개</p>
            <p>공개 수업 수: {mentor.publishedCourseCount}개</p>
            <p>대기 수업 신청: {mentor.pendingCourseApplicationCount}건</p>
          </section>
        </>
      ),
    });
  }

  function renderAdminCourseDetail(course) {
    const isProcessing = activeAdminCourseId === course.id;

    return renderDetailFrame({
      eyebrow: '운영 콘솔',
      title: course.title,
      badge: formatMentorCourseStatus(course.status),
      tone:
        course.status === 'PUBLISHED'
          ? 'accepted'
          : course.status === 'ARCHIVED'
            ? 'muted'
            : 'info',
      meta: `${course.mentorNickname} · ${formatCurrency(course.price)}`,
      actions: (
        <>
          {course.status !== 'PUBLISHED' ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => handleAdminCourseStatusChange(course.id, 'PUBLISHED')}
              disabled={isProcessing}
            >
              {isProcessing ? '처리 중...' : '공개 전환'}
            </button>
          ) : null}
          {course.status !== 'DRAFT' ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleAdminCourseStatusChange(course.id, 'DRAFT')}
              disabled={isProcessing}
            >
              초안 전환
            </button>
          ) : null}
          {course.status !== 'ARCHIVED' ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleAdminCourseStatusChange(course.id, 'ARCHIVED')}
              disabled={isProcessing}
            >
              보관 전환
            </button>
          ) : null}
        </>
      ),
      children: (
        <>
          {adminConsoleNotice ? <p className="app-success">{adminConsoleNotice}</p> : null}
          {adminConsoleError ? <p className="app-error">{adminConsoleError}</p> : null}
          <section className="activity-detail__section">
            <h3>수업 상태</h3>
            <p>멘토: {course.mentorNickname}</p>
            <p>현재 상태: {formatMentorCourseStatus(course.status)}</p>
            <p>정원: {course.capacity}명</p>
            <p>잔여 좌석: {course.remainingCapacity}석</p>
          </section>
          <section className="activity-detail__section">
            <h3>신청 현황</h3>
            <p>승인 인원: {course.approvedApplicationCount}명</p>
            <p>대기 신청: {course.pendingApplicationCount}건</p>
          </section>
        </>
      ),
    });
  }

  function renderMentorManagementDetail(profile) {
    const managedProfile = profile || mentorManagementProfile;
    const publishedCourseCount =
      managedProfile?.courses?.filter((course) => course.status === 'PUBLISHED').length || 0;

    return renderDetailFrame({
      eyebrow: '멘토 관리',
      title: managedProfile?.nickname || currentUser?.nickname || '내 멘토 관리',
      badge: mentorProfileEnabled ? '노출 중' : '비노출',
      tone: mentorProfileEnabled ? 'accepted' : 'muted',
      meta: managedProfile?.email || '멘토 프로필',
      actions: (
        <>
          <button
            type="submit"
            form="mentor-profile-form"
            className="primary-button"
            disabled={mentorProfileStatus === 'saving'}
          >
            {mentorProfileStatus === 'saving' ? '저장 중...' : '프로필 저장'}
          </button>
          <button
            type="submit"
            form="mentor-availability-form"
            className="secondary-button"
            disabled={mentorAvailabilityStatus === 'saving'}
          >
            {mentorAvailabilityStatus === 'saving' ? '저장 중...' : '가능 시간 저장'}
          </button>
        </>
      ),
      children: (
        <>
          {mentorProfileNotice ? <p className="app-success">{mentorProfileNotice}</p> : null}
          {mentorProfileError ? <p className="app-error">{mentorProfileError}</p> : null}
          {mentorAvailabilityNotice ? <p className="app-success">{mentorAvailabilityNotice}</p> : null}
          {mentorAvailabilityError ? <p className="app-error">{mentorAvailabilityError}</p> : null}
          {mentorCourseNotice ? <p className="app-success">{mentorCourseNotice}</p> : null}
          {mentorCourseError ? <p className="app-error">{mentorCourseError}</p> : null}

          <section className="activity-detail__section">
            <h3>운영 현황</h3>
            <p>멘토 공개 상태: {mentorProfileEnabled ? '멘토 목록에 노출되고 있습니다.' : '멘토 목록에서 숨김 상태입니다.'}</p>
            <p>등록한 가능 시간: {mentorAvailabilityDrafts.length}개</p>
            <p>공개 중인 수업: {publishedCourseCount}개</p>
          </section>

          <section className="activity-detail__section">
            <h3>프로필 설정</h3>
            <form id="mentor-profile-form" className="mentoring-form" onSubmit={handleMentorProfileSave}>
              <label className="app-field">
                <span>소개</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorProfileBio}
                  onChange={(event) => setMentorProfileBio(event.target.value)}
                  rows={3}
                  placeholder="멘토로 어떤 도움을 줄 수 있는지 적어 주세요."
                  disabled={mentorProfileStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>전문 분야</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorProfileSpecialties}
                  onChange={(event) => setMentorProfileSpecialties(event.target.value)}
                  rows={2}
                  placeholder="예: Spring Boot, 포트폴리오 리뷰, 커리어 상담"
                  disabled={mentorProfileStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>관심사</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorProfileInterests}
                  onChange={(event) => setMentorProfileInterests(event.target.value)}
                  rows={2}
                  placeholder="예: 백엔드 설계, 테스트 코드, 이직 준비"
                  disabled={mentorProfileStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>아바타 URL</span>
                <input
                  className="app-input"
                  value={mentorProfileAvatarUrl}
                  onChange={(event) => setMentorProfileAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.png"
                  disabled={mentorProfileStatus === 'saving'}
                />
              </label>
              <label className="app-checkbox">
                <input
                  type="checkbox"
                  checked={mentorProfileEnabled}
                  onChange={(event) => setMentorProfileEnabled(event.target.checked)}
                  disabled={mentorProfileStatus === 'saving'}
                />
                <span>멘토 목록에 프로필 공개하기</span>
              </label>
            </form>
          </section>

          <section className="activity-detail__section">
            <h3>멘토 가능 시간</h3>
            <p>가능 시간을 등록하면 사용자가 그 시간대 안에서만 예약을 제안할 수 있습니다.</p>
            <form id="mentor-availability-form" className="mentoring-form" onSubmit={handleMentorAvailabilitySave}>
              <div className="mentor-availability-list">
                {mentorAvailabilityDrafts.length === 0 ? (
                  <p>아직 등록된 가능 시간이 없습니다. 최소 한 개 이상 추가하면 예약 유도에 도움이 됩니다.</p>
                ) : (
                  mentorAvailabilityDrafts.map((draft) => (
                    <div key={draft.id} className="mentor-availability-row">
                      <select
                        className="app-input"
                        value={draft.dayOfWeek}
                        onChange={(event) =>
                          handleAvailabilityDraftChange(draft.id, 'dayOfWeek', event.target.value)
                        }
                        disabled={mentorAvailabilityStatus === 'saving'}
                      >
                        {Object.entries(DAY_OF_WEEK_LABELS).map(([dayKey, dayLabel]) => (
                          <option key={dayKey} value={dayKey}>
                            {dayLabel}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        className="app-input"
                        value={draft.startTime}
                        onChange={(event) =>
                          handleAvailabilityDraftChange(draft.id, 'startTime', event.target.value)
                        }
                        disabled={mentorAvailabilityStatus === 'saving'}
                      />
                      <input
                        type="time"
                        className="app-input"
                        value={draft.endTime}
                        onChange={(event) =>
                          handleAvailabilityDraftChange(draft.id, 'endTime', event.target.value)
                        }
                        disabled={mentorAvailabilityStatus === 'saving'}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleRemoveAvailabilityDraft(draft.id)}
                        disabled={mentorAvailabilityStatus === 'saving'}
                      >
                        삭제
                      </button>
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={handleAddAvailabilityDraft}
                disabled={mentorAvailabilityStatus === 'saving'}
              >
                가능 시간 추가
              </button>
            </form>
          </section>

          <section className="activity-detail__section">
            <h3>{mentorCourseFormMode === 'edit' ? '수업 수정' : '수업 개설'}</h3>
            <form className="mentoring-form" onSubmit={handleMentorCourseSubmit}>
              <label className="app-field">
                <span>수업명</span>
                <input
                  className="app-input"
                  value={mentorCourseForm.title}
                  onChange={(event) =>
                    setMentorCourseForm((currentForm) => ({
                      ...currentForm,
                      title: event.target.value,
                    }))
                  }
                  placeholder="예: 취업 준비 백엔드 코드 리뷰"
                  disabled={mentorCourseStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>짧은 소개</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorCourseForm.summary}
                  onChange={(event) =>
                    setMentorCourseForm((currentForm) => ({
                      ...currentForm,
                      summary: event.target.value,
                    }))
                  }
                  rows={2}
                  placeholder="사용자 목록에 노출될 한 줄 소개입니다."
                  disabled={mentorCourseStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>상세 설명</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentorCourseForm.description}
                  onChange={(event) =>
                    setMentorCourseForm((currentForm) => ({
                      ...currentForm,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="어떤 내용을 다루는지 자세히 적어 주세요."
                  disabled={mentorCourseStatus === 'saving'}
                />
              </label>
              <div className="mentor-course-grid">
                <label className="app-field">
                  <span>진행 방식</span>
                  <select
                    className="app-input"
                    value={mentorCourseForm.meetingType}
                    onChange={(event) =>
                      setMentorCourseForm((currentForm) => ({
                        ...currentForm,
                        meetingType: event.target.value,
                      }))
                    }
                    disabled={mentorCourseStatus === 'saving'}
                  >
                    <option value="ONLINE">온라인</option>
                    <option value="OFFLINE">오프라인</option>
                    <option value="HYBRID">온오프라인</option>
                  </select>
                </label>
                <label className="app-field">
                  <span>가격</span>
                  <input
                    type="number"
                    min="0"
                    className="app-input"
                    value={mentorCourseForm.price}
                    onChange={(event) =>
                      setMentorCourseForm((currentForm) => ({
                        ...currentForm,
                        price: event.target.value,
                      }))
                    }
                    disabled={mentorCourseStatus === 'saving'}
                  />
                </label>
                <label className="app-field">
                  <span>정원</span>
                  <input
                    type="number"
                    min="1"
                    className="app-input"
                    value={mentorCourseForm.capacity}
                    onChange={(event) =>
                      setMentorCourseForm((currentForm) => ({
                        ...currentForm,
                        capacity: event.target.value,
                      }))
                    }
                    disabled={mentorCourseStatus === 'saving'}
                  />
                </label>
                <label className="app-field">
                  <span>공개 상태</span>
                  <select
                    className="app-input"
                    value={mentorCourseForm.status}
                    onChange={(event) =>
                      setMentorCourseForm((currentForm) => ({
                        ...currentForm,
                        status: event.target.value,
                      }))
                    }
                    disabled={mentorCourseStatus === 'saving'}
                  >
                    <option value="DRAFT">초안</option>
                    <option value="PUBLISHED">공개</option>
                    <option value="ARCHIVED">보관</option>
                  </select>
                </label>
              </div>
              <div className="mentor-course-curriculum">
                <div className="mentor-course-curriculum__header">
                  <strong>커리큘럼</strong>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleAddCurriculumItem}
                    disabled={mentorCourseStatus === 'saving'}
                  >
                    커리큘럼 추가
                  </button>
                </div>
                {mentorCourseForm.curriculumItems.map((item, itemIndex) => (
                  <div key={item.id} className="mentor-course-curriculum__item">
                    <label className="app-field">
                      <span>{itemIndex + 1}단계 제목</span>
                      <input
                        className="app-input"
                        value={item.title}
                        onChange={(event) =>
                          handleCurriculumItemChange(item.id, 'title', event.target.value)
                        }
                        placeholder="예: 현재 코드 구조 진단"
                        disabled={mentorCourseStatus === 'saving'}
                      />
                    </label>
                    <label className="app-field">
                      <span>{itemIndex + 1}단계 설명</span>
                      <textarea
                        className="app-input mentoring-textarea"
                        value={item.description}
                        onChange={(event) =>
                          handleCurriculumItemChange(item.id, 'description', event.target.value)
                        }
                        rows={3}
                        placeholder="이 단계에서 무엇을 다루는지 적어 주세요."
                        disabled={mentorCourseStatus === 'saving'}
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleRemoveCurriculumItem(item.id)}
                      disabled={mentorCourseStatus === 'saving'}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <div className="activity-detail__actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={mentorCourseStatus === 'saving'}
                >
                  {mentorCourseStatus === 'saving'
                    ? '저장 중...'
                    : mentorCourseFormMode === 'edit'
                      ? '수업 수정'
                      : '수업 개설'}
                </button>
                {mentorCourseFormMode === 'edit' ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetMentorCourseEditor}
                    disabled={mentorCourseStatus === 'saving'}
                  >
                    편집 취소
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="activity-detail__section">
            <h3>개설한 수업</h3>
            {managedProfile?.courses?.length ? (
              <div className="mentor-course-list">
                {managedProfile.courses.map((course) => (
                  <article key={course.id} className="mentor-course-card">
                    <div className="mentor-course-card__header">
                      <div>
                        <strong>{course.title}</strong>
                        <p>{course.summary || '요약이 없습니다.'}</p>
                      </div>
                      <span className={`activity-badge activity-badge--${course.status === 'PUBLISHED' ? 'accepted' : course.status === 'ARCHIVED' ? 'muted' : 'info'}`}>
                        {formatMentorCourseStatus(course.status)}
                      </span>
                    </div>
                    <p>{course.description || '설명이 없습니다.'}</p>
                    <div className="mentor-course-card__meta">
                      <span>{formatMeetingTypeLabel(course.meetingType)}</span>
                      <span>{formatCurrency(course.price)}</span>
                      <span>정원 {course.capacity}명</span>
                      <span>승인 {course.approvedApplicationCount}명</span>
                      <span>잔여 {course.remainingCapacity}석</span>
                    </div>
                    {course.curriculumItems?.length ? (
                      <div className="mentor-course-curriculum-preview">
                        {course.curriculumItems.map((item) => (
                          <p key={item.id}>
                            {item.sequence}. {item.title}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <div className="activity-detail__actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => navigate(`/courses/${course.id}`)}
                      >
                        상세 보기
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleEditMentorCourse(course)}
                      >
                        편집
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>아직 개설한 수업이 없습니다. 초안으로 저장한 뒤 공개 상태로 전환할 수 있습니다.</p>
            )}
          </section>
        </>
      ),
    });
  }

  function renderReceivedCourseApplicationDetail(application) {
    const isPending = application.status === 'PENDING';
    const isProcessing = activeCourseApplicationId === application.id;

    return renderDetailFrame({
      eyebrow: '받은 수업 신청',
      title: application.courseTitle,
      badge: formatCourseApplicationStatus(application.status),
      tone: getStatusTone(
        application.status === 'APPROVED'
          ? 'ACCEPTED'
          : application.status === 'REJECTED'
            ? 'REJECTED'
            : application.status === 'CANCELED'
              ? 'CANCELED'
              : 'PENDING'
      ),
      meta: `${application.applicantNickname} · ${formatDateTime(application.createdAt)}`,
      actions:
        isPending ? (
          <>
            <button
              type="button"
              className="primary-button"
              onClick={() => handleReceivedCourseApplicationDecision(application.id, 'approve')}
              disabled={isProcessing}
            >
              {isProcessing ? '처리 중...' : '승인'}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleReceivedCourseApplicationDecision(application.id, 'reject')}
              disabled={isProcessing}
            >
              반려
            </button>
          </>
        ) : null,
      children: (
        <>
          {courseApplicationNotice ? <p className="app-success">{courseApplicationNotice}</p> : null}
          {courseApplicationError ? <p className="app-error">{courseApplicationError}</p> : null}
          <section className="activity-detail__section">
            <h3>신청자 정보</h3>
            <p>신청자: {application.applicantNickname}</p>
            <p>진행 방식: {formatMeetingTypeLabel(application.courseMeetingType)}</p>
            <p>가격: {formatCurrency(application.coursePrice)}</p>
          </section>
          <section className="activity-detail__section">
            <h3>신청 메시지</h3>
            <p>{application.message || '남긴 메시지가 없습니다.'}</p>
          </section>
          {application.status === 'PENDING' ? (
            <section className="activity-detail__section">
              <h3>검토 메모</h3>
              <textarea
                className="app-input mentoring-textarea"
                value={courseApplicationReviewNote}
                onChange={(event) => setCourseApplicationReviewNote(event.target.value)}
                rows={3}
                placeholder="승인 또는 반려 사유를 남길 수 있습니다."
                disabled={isProcessing}
              />
            </section>
          ) : null}
          {application.reviewNote ? (
            <section className="activity-detail__section">
              <h3>남긴 검토 메모</h3>
              <p>{application.reviewNote}</p>
            </section>
          ) : null}
        </>
      ),
    });
  }

  function renderSentCourseApplicationDetail(application) {
    const isPending = application.status === 'PENDING';
    const isProcessing = activeCourseApplicationId === application.id;

    return renderDetailFrame({
      eyebrow: '내 진행',
      title: application.courseTitle,
      badge: formatCourseApplicationStatus(application.status),
      tone: getStatusTone(
        application.status === 'APPROVED'
          ? 'ACCEPTED'
          : application.status === 'REJECTED'
            ? 'REJECTED'
            : application.status === 'CANCELED'
              ? 'CANCELED'
              : 'PENDING'
      ),
      meta: `${application.mentorNickname} · ${formatDateTime(application.createdAt)}`,
      actions:
        isPending ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => handleCancelCourseApplication(application.id)}
            disabled={isProcessing}
          >
            {isProcessing ? '취소 중...' : '신청 취소'}
          </button>
        ) : null,
      children: (
        <>
          {courseApplicationNotice ? <p className="app-success">{courseApplicationNotice}</p> : null}
          {courseApplicationError ? <p className="app-error">{courseApplicationError}</p> : null}
          <section className="activity-detail__section">
            <h3>수업 정보</h3>
            <p>멘토: {application.mentorNickname}</p>
            <p>진행 방식: {formatMeetingTypeLabel(application.courseMeetingType)}</p>
            <p>가격: {formatCurrency(application.coursePrice)}</p>
          </section>
          <section className="activity-detail__section">
            <h3>내 신청 메시지</h3>
            <p>{application.message || '남긴 메시지가 없습니다.'}</p>
          </section>
          <section className="activity-detail__section">
            <h3>현재 상태</h3>
            <p>
              {application.status === 'PENDING'
                ? '멘토가 신청 내용을 검토 중입니다.'
                : application.status === 'APPROVED'
                  ? '수업 신청이 승인되었습니다. 멘토와 상세 일정을 조율하면 됩니다.'
                  : application.status === 'REJECTED'
                    ? '수업 신청이 반려되었습니다. 다른 수업을 신청하거나 내용을 보완해 다시 신청할 수 있습니다.'
                    : '이 수업 신청은 취소되었습니다.'}
            </p>
            {application.reviewNote ? <p>멘토 메모: {application.reviewNote}</p> : null}
          </section>
        </>
      ),
    });
  }

  function renderSelectedDetail() {
    if (!selectedItem) {
      return renderEmptyDetail();
    }

    if (selectedItem.kind === 'received_request') {
      return renderReceivedRequestDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'received_course_application') {
      return renderReceivedCourseApplicationDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'received_reservation') {
      return renderReceivedReservationDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'sent_request') {
      return renderSentRequestDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'sent_course_application') {
      return renderSentCourseApplicationDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'sent_reservation') {
      return renderSentReservationDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'notification') {
      return renderNotificationDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'mentor_application_self') {
      return renderMyMentorApplicationDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'mentor_application_review') {
      return renderMentorApplicationReviewDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'admin_dashboard') {
      return renderAdminDashboardDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'admin_mentor') {
      return renderAdminMentorDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'admin_course') {
      return renderAdminCourseDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'mentor_management') {
      return renderMentorManagementDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'mentor_profile') {
      return renderMentorProfileDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'feedback_prompt') {
      return renderFeedbackPromptDetail(selectedItem.raw);
    }

    if (selectedItem.kind === 'feedback_history') {
      return renderFeedbackHistoryDetail(selectedItem.raw);
    }

    return renderEmptyDetail();
  }

  function renderMentorProfileDetail(mentor) {
    const selectedCourse =
      mentor.courses?.find((course) => String(course.id) === String(selectedCourseId)) ||
      mentor.courses?.[0] ||
      null;
    const isSelectedCourseFull = selectedCourse ? selectedCourse.remainingCapacity <= 0 : false;

    return renderDetailFrame({
      eyebrow: '멘토 찾기',
      title: mentor.nickname,
      badge: '멘토',
      tone: 'accepted',
      meta: mentor.specialties || '멘토 프로필',
      children: (
        <>
          {mentoringFeedback ? <p className="app-success">{mentoringFeedback}</p> : null}
          {mentoringError ? <p className="app-error">{mentoringError}</p> : null}
          {reservationCreateNotice ? <p className="app-success">{reservationCreateNotice}</p> : null}
          {reservationCreateError ? <p className="app-error">{reservationCreateError}</p> : null}
          {courseApplicationNotice ? <p className="app-success">{courseApplicationNotice}</p> : null}
          {courseApplicationError ? <p className="app-error">{courseApplicationError}</p> : null}

          <section className="activity-detail__section">
            <h3>소개</h3>
            <p>{mentor.bio || '아직 등록된 소개가 없습니다.'}</p>
          </section>

          <section className="activity-detail__section">
            <h3>전문 분야</h3>
            <p>{mentor.specialties || '등록된 전문 분야가 없습니다.'}</p>
          </section>

          <section className="activity-detail__section">
            <h3>관심사</h3>
            <p>{mentor.interests || '등록된 관심사가 없습니다.'}</p>
          </section>

          <section className="activity-detail__section">
            <h3>가능 시간</h3>
            {mentor.availabilitySlots?.length ? (
              <>
                {mentor.availabilitySlots.map((slot) => (
                  <p key={slot.id}>{formatAvailabilitySlot(slot)}</p>
                ))}
              </>
            ) : (
              <p>아직 공개된 가능 시간이 없습니다. 메시지로 먼저 조율할 수 있습니다.</p>
            )}
          </section>

          <section className="activity-detail__section">
            <h3>개설 수업</h3>
            {mentor.courses?.length ? (
              <div className="mentor-course-list">
                {mentor.courses.map((course) => (
                  <article key={course.id} className="mentor-course-card">
                    <div className="mentor-course-card__header">
                      <div>
                        <strong>{course.title}</strong>
                        <p>{course.summary || '요약이 없습니다.'}</p>
                      </div>
                      <span className="activity-badge activity-badge--accepted">공개 중</span>
                    </div>
                    <p>{course.description || '설명이 없습니다.'}</p>
                    <div className="mentor-course-card__meta">
                      <span>{formatMeetingTypeLabel(course.meetingType)}</span>
                      <span>{formatCurrency(course.price)}</span>
                      <span>정원 {course.capacity}명</span>
                      <span>승인 {course.approvedApplicationCount}명</span>
                      <span>잔여 {course.remainingCapacity}석</span>
                    </div>
                    {course.curriculumItems?.length ? (
                      <div className="mentor-course-curriculum-preview">
                        {course.curriculumItems.map((item) => (
                          <p key={item.id}>
                            {item.sequence}. {item.title}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    <div className="activity-detail__actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => navigate(`/courses/${course.id}`)}
                      >
                        상세 보기
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>아직 공개된 수업이 없습니다.</p>
            )}
          </section>

          {mentor.courses?.length ? (
            <section className="activity-detail__section">
              <h3>수업 신청 보내기</h3>
              <form className="mentoring-form" onSubmit={(event) => handleCreateCourseApplication(event, mentor)}>
                <label className="app-field">
                  <span>신청할 수업</span>
                  <select
                    className="app-input"
                    value={selectedCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                    disabled={courseApplicationStatus === 'saving'}
                  >
                    {mentor.courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title} · {formatCurrency(course.price)} · 잔여 {course.remainingCapacity}석
                      </option>
                    ))}
                  </select>
                </label>
                {selectedCourse ? (
                  <p className="mentor-course-application-note">
                    현재 선택한 수업은 {selectedCourse.approvedApplicationCount}명이 승인되었고,
                    남은 좌석은 {selectedCourse.remainingCapacity}석입니다.
                  </p>
                ) : null}
                <label className="app-field">
                  <span>신청 메시지</span>
                  <textarea
                    className="app-input mentoring-textarea"
                    value={courseApplicationMessage}
                    onChange={(event) => setCourseApplicationMessage(event.target.value)}
                    rows={3}
                    placeholder="왜 이 수업을 신청하는지, 어떤 도움을 받고 싶은지 적어 주세요."
                    disabled={courseApplicationStatus === 'saving'}
                  />
                </label>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={courseApplicationStatus === 'saving' || isSelectedCourseFull}
                >
                  {courseApplicationStatus === 'saving'
                    ? '신청 중...'
                    : isSelectedCourseFull
                      ? '잔여 좌석 없음'
                      : '수업 신청'}
                </button>
              </form>
            </section>
          ) : null}

          <section className="activity-detail__section">
            <h3>멘토링 요청 보내기</h3>
            <form className="mentoring-form" onSubmit={(event) => handleMentoringSubmit(event, mentor.id)}>
              <label className="app-field">
                <span>메시지</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={mentoringMessage}
                  onChange={(event) => setMentoringMessage(event.target.value)}
                  rows={3}
                  placeholder="어떤 도움을 받고 싶은지 간단히 적어 주세요."
                />
              </label>
              <button type="submit" className="primary-button" disabled={isSubmittingRequest}>
                {isSubmittingRequest ? '전송 중...' : '요청 보내기'}
              </button>
            </form>
          </section>

          <section className="activity-detail__section">
            <h3>예약 제안 보내기</h3>
            {mentor.availabilitySlots?.length ? (
              <p>아래 예약은 멘토가 공개한 가능 시간 안에서만 생성할 수 있습니다.</p>
            ) : (
              <p>가능 시간이 아직 등록되지 않아 자유롭게 예약 제안을 보낼 수 있습니다.</p>
            )}
            <form className="mentoring-form" onSubmit={(event) => handleCreateReservation(event, mentor.id)}>
              <label className="app-field">
                <span>예약 시간</span>
                <input
                  type="datetime-local"
                  className="app-input"
                  value={reservationDateTime}
                  onChange={(event) => setReservationDateTime(event.target.value)}
                  disabled={reservationCreateStatus === 'saving'}
                />
              </label>
              <label className="app-field">
                <span>메시지</span>
                <textarea
                  className="app-input mentoring-textarea"
                  value={reservationCreateMessage}
                  onChange={(event) => setReservationCreateMessage(event.target.value)}
                  rows={3}
                  placeholder="예약에서 다루고 싶은 내용을 적어 주세요."
                  disabled={reservationCreateStatus === 'saving'}
                />
              </label>
              <button
                type="submit"
                className="primary-button"
                disabled={reservationCreateStatus === 'saving'}
              >
                {reservationCreateStatus === 'saving' ? '예약 저장 중...' : '예약 만들기'}
              </button>
            </form>
          </section>
        </>
      ),
    });
  }

  return (
    <AppLayout panelClassName="app-panel--wide activity-page-shell" headerHidden>
      <section className="activity-page">
        <header className="activity-page__header">
          <div className="activity-page__heading">
            <span className="activity-page__eyebrow">내 활동</span>
            <h1>요청, 예약, 알림을 한곳에서 확인하세요</h1>
            <p>메타버스에서 시작된 연결을 정리하고, 수락된 세션은 여기서 바로 이어갈 수 있습니다.</p>
          </div>

          <div className="activity-page__header-actions">
            <div className="activity-page__user">
              {currentUser ? (
                <>
                  <strong>{currentUser.nickname}</strong>
                  <span>{currentRoleLabel} · {currentUser.email}</span>
                </>
              ) : (
                <span>사용자 불러오는 중...</span>
              )}
            </div>
            <button type="button" className="secondary-button" onClick={() => navigate('/lobby')}>
              로비
            </button>
            <button type="button" className="primary-button" onClick={handleEnterMetaverse}>
              메타버스 입장
            </button>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </header>

        <section className="activity-page__summary">
          {sectionSummaryItems.map((summaryItem) => (
            <article key={summaryItem.label} className="activity-summary-card">
              <span>{summaryItem.label}</span>
              <strong>{summaryItem.value}</strong>
            </article>
          ))}
        </section>

        <div className="activity-page__notices">
          {pageNotice ? <p className="app-success">{pageNotice}</p> : null}
          {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
          <div className="activity-role-banner">
            <strong>{isMentorAccount ? '멘토 계정으로 보고 있습니다.' : '일반 사용자 계정으로 보고 있습니다.'}</strong>
            <span>
              {currentUser?.role === 'ADMIN'
                ? '멘토 지원 검토, 멘토 노출 제어, 수업 공개 상태 운영을 여기서 처리할 수 있습니다.'
                : isMentorAccount
                ? '받은 멘토링 요청과 예약을 여기서 확인하고 수락한 뒤 세션으로 이어갈 수 있습니다.'
                : '멘토 신청과 멘토링 요청은 여기서 관리합니다. 승인 전까지는 일반 사용자 계정으로 동작합니다.'}
            </span>
          </div>
        </div>

        <section className="activity-page__layout">
          <aside className="activity-page__sidebar" aria-label="활동 목록">
            <div className="activity-category-list">
              {categoryDefinitions.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={
                    activeCategory === category.id
                      ? 'activity-category-button activity-category-button--active'
                      : 'activity-category-button'
                  }
                  onClick={() => focusCategory(category.id)}
                >
                  <span>{category.label}</span>
                  <strong>{category.count}</strong>
                </button>
              ))}
            </div>

            {renderMentorFilterPanel()}

            <div className="activity-thread-list">
              {isLoading ? (
                <div className="activity-list__empty">
                  <strong>내 활동을 불러오는 중입니다.</strong>
                  <p>요청, 예약, 알림을 정리하고 있습니다.</p>
                </div>
              ) : activeItems.length === 0 ? (
                renderSidebarEmpty()
              ) : (
                activeItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      selectedItem?.id === item.id
                        ? 'activity-thread activity-thread--active'
                        : 'activity-thread'
                    }
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <div className="activity-thread__header">
                      <strong>{item.title}</strong>
                      {item.unread ? <span className="activity-thread__dot" aria-hidden="true" /> : null}
                    </div>
                    <p>{item.preview}</p>
                    <div className="activity-thread__meta">
                      <span className={`activity-badge activity-badge--${item.tone || 'info'}`}>
                        {item.badge}
                      </span>
                      <small>{item.meta}</small>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="activity-page__detail" aria-label="활동 상세">
            {renderSelectedDetail()}
          </section>
        </section>
      </section>
    </AppLayout>
  );
}
