import React, {useState, useEffect} from "react";
import './Calander.css';

function Calander() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [daysinMonth, setDaysinMonth] = useState([]);
    const [startDay, setStartDay] = useState(0);
    const [selectedDate, setSelectedDate] = useState(null);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const date = new Date(year, month, 1);
        const days = [];

        while (date.getMonth() === month) {
            days.push(new Date(date));
            date.setDate(date.getDate() + 1);
        }

        setDaysinMonth(days);
        setStartDay(new Date(year, month, 1).getDay());
    }, [currentDate]);

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }

    return(
        <div className="calandar">
            <div className="header">
                <button onClick={prevMonth}>&lt;</button>
                <span>{currentDate.toLocaleString('default', { month: 'long' })}{' '}{currentDate.getFullYear()}</span>
                <button onClick={nextMonth}>&gt;</button>
            </div>
            <div className="day-names">
                {dayNames.map((day) => (
                    <div key={day} className="day-name">
                        {day}
                    </div>
                ))}
                {Array.from({ length: startDay }, (_, i) => (
                    <div key={`empty-${i}`} className="empty-day"></div>
                ))}
                {daysinMonth.map((day, index) => (
                    <div 
                        key={index} 
                        className={`day ${selectedDate && day.toDateString() === selectedDate.toDateString() ? 'selected' : ''}`}
                        onClick={() => setSelectedDate(day)}
                    >
                        {day.getDate()}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Calander;